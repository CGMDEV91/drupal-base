<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Subscription endpoints.
 *
 * POST /api/subscription/create   — create Stripe PaymentIntent + Customer
 * POST /api/subscription/activate — verify payment, create Stripe Subscription + Drupal nodes
 * POST /api/subscription/cancel   — cancel Stripe Subscription
 */
class SubscriptionController extends ControllerBase {

  /**
   * POST /api/subscription/create — authenticated.
   *
   * Body: { planId: "uuid" }
   * Returns: { clientSecret, subscriptionId, paymentIntentId, stripeCustomerId }
   *
   * Creates a Stripe Subscription with payment_behavior=default_incomplete so
   * the first invoice IS the initial charge — no separate PaymentIntent.
   * The frontend confirms payment with stripe.confirmCardPayment(clientSecret).
   * After confirmation, the frontend calls /api/subscription/activate.
   *
   * This avoids double-charging: one Stripe Subscription handles both the
   * initial payment and all future auto-renewals.
   */
  public function createSubscription(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['planId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing planId'], 400));
    }

    $planUuid = $body['planId'];

    $plans = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $planUuid, 'type' => 'subscription_plan', 'status' => 1]);

    if (empty($plans)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Plan not found'], 404));
    }

    $plan         = reset($plans);
    $price        = (float) ($plan->get('field_price')->value ?? 0);
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'month';

    if ($price <= 0) {
      return $this->corsResponse(new JsonResponse(['error' => 'Free plans do not require payment'], 400));
    }

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      $currentUser = \Drupal::currentUser();
      $userUid     = (int) $currentUser->id();
      $userEntity  = \Drupal\user\Entity\User::load($userUid);
      $userEmail   = $userEntity ? $userEntity->getEmail() : '';
      $userName    = $userEntity ? $userEntity->getAccountName() : 'user' . $userUid;

      // ── Guard: reject if user already has an active, non-expired subscription ──
      $now = time();
      $activeExisting = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                      => 'subscription',
          'field_user'                => $userUid,
          'field_subscription_status' => 'active',
        ]);
      foreach ($activeExisting as $existing) {
        $endTs = (int) ($existing->get('field_end_date')->value ?? 0);
        if ($endTs > $now) {
          return $this->corsResponse(new JsonResponse([
            'error' => 'You already have an active subscription',
            'code'  => 'ALREADY_SUBSCRIBED',
          ], 409));
        }
      }

      $customerId = $this->getOrCreateStripeCustomer($userUid, $userEmail, $userName);
      $priceId    = $this->getOrCreateStripePrice($plan, $planUuid, $price, $billingCycle);

      // ── Step 1: Create Stripe Subscription (trial covers the first paid period).
      // The user pays the first period via PaymentIntent below.
      // trial_end = now + 1 billing interval so Stripe starts charging on renewal,
      // not immediately — prevents double-charging.
      $trialEnd  = $this->getNextBillingDate($billingCycle);
      $stripeSub = \Stripe\Subscription::create([
        'customer'  => $customerId,
        'items'     => [['price' => $priceId]],
        'trial_end' => $trialEnd->getTimestamp(),
        'metadata'  => [
          'plan_uuid'     => $planUuid,
          'plan_nid'      => (string) $plan->id(),
          'user_uid'      => (string) $userUid,
          'billing_cycle' => $billingCycle,
          'customer_id'   => $customerId,
        ],
      ]);

      // ── Step 2: Create PaymentIntent for the initial (first period) charge.
      // setup_future_usage saves the PM to the customer for recurring use.
      $paymentIntent = \Stripe\PaymentIntent::create([
        'amount'             => (int) round($price * 100),
        'currency'           => 'eur',
        'customer'           => $customerId,
        'setup_future_usage' => 'off_session',
        'metadata'           => [
          'type'              => 'subscription',
          'plan_uuid'         => $planUuid,
          'plan_nid'          => (string) $plan->id(),
          'user_uid'          => (string) $userUid,
          'billing_cycle'     => $billingCycle,
          'customer_id'       => $customerId,
          'stripe_sub_id'     => $stripeSub->id,
        ],
        'description' => 'StepUp Tours — ' . $plan->label() . ' (' . $billingCycle . ')',
      ]);

      return $this->corsResponse(new JsonResponse([
        'clientSecret'     => $paymentIntent->client_secret,
        'subscriptionId'   => $stripeSub->id,
        'paymentIntentId'  => $paymentIntent->id,
        'stripeCustomerId' => $customerId,
      ], 200));

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription create error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Payment processing error: ' . $e->getMessage()], 500));
    }
  }

  /**
   * POST /api/subscription/activate — authenticated.
   *
   * Body: { subscriptionId: "sub_...", planId: "uuid" }
   *
   * subscriptionId = Stripe Subscription ID returned by /api/subscription/create.
   *
   * 1. Idempotency: if Drupal node already exists for this Stripe sub, return it.
   * 2. Retrieves the Stripe Subscription to verify status and get period dates.
   * 3. Creates the Drupal subscription node using Stripe's current_period_end.
   * 4. Creates subscription_payment node (only if webhook hasn't already done so).
   *
   * The webhook invoice.payment_succeeded runs concurrently and handles the same
   * work. Both paths are idempotent so whichever runs first wins.
   */
  public function activate(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['subscriptionId']) || empty($body['planId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing subscriptionId or planId'], 400));
    }

    $stripeSubId     = $body['subscriptionId'];   // Stripe Subscription ID (sub_xxx)
    $paymentIntentId = $body['paymentIntentId'] ?? '';  // PI from initial charge
    $planUuid        = $body['planId'];

    $plans = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $planUuid, 'type' => 'subscription_plan', 'status' => 1]);

    if (empty($plans)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Plan not found'], 404));
    }

    $plan  = reset($plans);
    $price = (float) ($plan->get('field_price')->value ?? 0);

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    $currentUser = \Drupal::currentUser();
    $userUid     = (int) $currentUser->id();

    // ── Idempotency: if Drupal node already exists for this Stripe sub ────────
    $existingNodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (!empty($existingNodes)) {
      $subNode = reset($existingNodes);
      return $this->corsResponse(new JsonResponse([
        'activated'      => TRUE,
        'subscriptionId' => $subNode->uuid(),
      ], 200));
    }

    // ── Retrieve Stripe Subscription + verify PaymentIntent ──────────────────
    $customerId  = '';
    $piId        = $paymentIntentId;
    $invoiceId   = '';
    $amount      = $price;
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'month';

    // The period the user paid for via PaymentIntent = 1 full billing interval.
    // NOTE: getNextBillingDate() returns a short trial window (e.g. 2 min for
    // 'day') used only for the Stripe Subscription trial_end. The actual period
    // the user sees must always be 1 full billing interval from now.
    $oneBillingInterval = (new \DateTime('now'))->modify('+1 ' . $billingCycle)->getTimestamp();

    $periodStart = time();
    $periodEnd   = $oneBillingInterval;

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      // Verify the Stripe Subscription is active/trialing.
      $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);

      if (!in_array($stripeSub->status, ['active', 'trialing'])) {
        return $this->corsResponse(new JsonResponse([
          'error' => 'Subscription not active (status: ' . $stripeSub->status . ')',
        ], 402));
      }

      // Use Stripe's authoritative period dates when available.
      // Stripe PHP SDK v19+ with API 2024+ may not include current_period_end
      // at subscription level (moved to items). trial_end is intentionally
      // excluded: for test plans it equals the short trial window (e.g. 2 min),
      // not the period the user paid for.
      $subArray    = $stripeSub->toArray();

      $periodStart = (int) (
        $subArray['current_period_start']
        ?? ($subArray['items']['data'][0]['current_period_start'] ?? null)
        ?? time()
      );

      // For active subscriptions Stripe provides current_period_end.
      // For trialing subscriptions current_period_end = trial_end (short window)
      // so we fall back to the computed billing interval instead.
      if ($stripeSub->status === 'active') {
        $periodEnd = (int) (
          ($subArray['current_period_end'] > 0 ? $subArray['current_period_end'] : null)
          ?? ($subArray['items']['data'][0]['current_period_end'] > 0 ? $subArray['items']['data'][0]['current_period_end'] : null)
          ?? $oneBillingInterval
        );
      }

      \Drupal::logger('stepuptours_api')->info(
        'Stripe sub @id — status: @st | period_end raw: @pe | trial_end raw: @te | resolved end: @res',
        [
          '@id'  => $stripeSubId,
          '@st'  => $stripeSub->status,
          '@pe'  => $subArray['current_period_end'] ?? 'null',
          '@te'  => $subArray['trial_end'] ?? 'null',
          '@res' => date('Y-m-d H:i:s', $periodEnd),
        ]
      );

      $customerId  = is_string($stripeSub->customer) ? $stripeSub->customer : ($stripeSub->customer->id ?? '');

      // Verify the PaymentIntent and attach PM to customer + subscription.
      if (!empty($paymentIntentId)) {
        $pi = \Stripe\PaymentIntent::retrieve($paymentIntentId);

        if ($pi->status !== 'succeeded') {
          return $this->corsResponse(new JsonResponse([
            'error' => 'Payment not confirmed (status: ' . $pi->status . ')',
          ], 402));
        }

        $amount = ($pi->amount ?? (int) round($price * 100)) / 100;
        $pmId   = is_string($pi->payment_method)
          ? $pi->payment_method
          : ($pi->payment_method->id ?? '');

        // Attach PM to customer and set as default so Stripe Subscription
        // can charge automatically on renewal.
        if (!empty($pmId) && !empty($customerId)) {
          try {
            $pm = \Stripe\PaymentMethod::retrieve($pmId);
            $pm->attach(['customer' => $customerId]);
          }
          catch (\Throwable $e) {
            // Already attached — safe to ignore.
          }
          \Stripe\Customer::update($customerId, [
            'invoice_settings' => ['default_payment_method' => $pmId],
          ]);
          \Stripe\Subscription::update($stripeSubId, [
            'default_payment_method' => $pmId,
          ]);
        }
      }

    } catch (\Throwable $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription activate error: @msg in @file:@line', [
        '@msg'  => $e->getMessage(),
        '@file' => $e->getFile(),
        '@line' => $e->getLine(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Failed to verify subscription: ' . $e->getMessage()], 500));
    }

    // ── Deactivate any other active subscriptions for this user ──────────────
    $activeOthers = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                      => 'subscription',
        'field_user'                => $userUid,
        'field_subscription_status' => 'active',
      ]);
    foreach ($activeOthers as $other) {
      $otherStripeId = $other->get('field_stripe_subscription_id')->value ?? '';
      if (!empty($otherStripeId) && $otherStripeId !== $stripeSubId) {
        try {
          \Stripe\Subscription::update($otherStripeId, ['cancel_at_period_end' => TRUE]);
        }
        catch (\Exception $e) {
          \Drupal::logger('stepuptours_api')->warning('Could not cancel previous Stripe sub @id: @msg', [
            '@id'  => $otherStripeId,
            '@msg' => $e->getMessage(),
          ]);
        }
      }
      // If the old subscription's period has already passed → expired.
      // If it still has time left → cancelled (user chose to switch plans).
      $otherEnd    = (int) ($other->get('field_end_date')->value ?? 0);
      $otherStatus = ($otherEnd > 0 && $otherEnd <= time()) ? 'expired' : 'cancelled';
      $other->set('field_subscription_status', $otherStatus);
      $other->save();
    }

    // ── Create Drupal subscription node ──────────────────────────────────────
    $user      = \Drupal\user\Entity\User::load($userUid);
    $name      = $user ? $user->getAccountName() : 'user' . $userUid;
    $startDt   = (new \DateTime())->setTimestamp($periodStart);

    $subNode = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                         => 'subscription',
      'title'                        => 'Subscription ' . $name . ' ' . $startDt->format('Y-m-d'),
      'status'                       => 1,
      'uid'                          => $userUid,
      'field_user'                   => ['target_id' => $userUid],
      'field_plan'                   => ['target_id' => (int) $plan->id()],
      'field_subscription_status'    => 'active',
      'field_start_date'             => $periodStart,
      'field_end_date'               => $periodEnd,
      'field_auto_renewal'           => TRUE,
      'field_stripe_subscription_id' => $stripeSubId,
      'field_stripe_customer_id'     => $customerId,
    ]);
    $subNode->save();

    // ── Create subscription_payment node (only if webhook hasn't already) ────
    // Check idempotency: webhook may have already created the payment node
    // while we were processing — find it by PaymentIntent or invoice ID.
    $paymentNodeCreated = FALSE;

    if (!empty($piId)) {
      $existingByPi = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                        => 'subscription_payment',
          'field_stripe_payment_intent' => $piId,
        ]);

      if (!empty($existingByPi)) {
        // Webhook already created it — link it to our subscription node.
        $existing = reset($existingByPi);
        $existing->set('field_subscription', ['target_id' => $subNode->id()]);
        if (!empty($invoiceId) && empty($existing->get('field_stripe_invoice_id')->value)) {
          $existing->set('field_stripe_invoice_id', $invoiceId);
        }
        $existing->save();
        $paymentNodeCreated = TRUE;
      }
    }

    if (!$paymentNodeCreated) {
      $payment = \Drupal::entityTypeManager()->getStorage('node')->create([
        'type'                        => 'subscription_payment',
        'title'                       => 'Payment ' . ($invoiceId ?: $stripeSubId),
        'status'                      => 1,
        'uid'                         => $userUid,
        'field_subscription'          => ['target_id' => $subNode->id()],
        'field_user'                  => ['target_id' => $userUid],
        'field_plan'                  => ['target_id' => (int) $plan->id()],
        'field_amount'                => (string) $amount,
        'field_stripe_invoice_id'     => $invoiceId,
        'field_stripe_payment_intent' => $piId,
        'field_payment_status'        => 'succeed',
        'field_period_start'          => $periodStart,
        'field_period_end'            => $periodEnd,
      ]);
      $payment->save();
    }

    \Drupal::logger('stepuptours_api')->info(
      'Subscription activated: node @nid, stripe sub @sub, user @uid, plan @plan, end @end',
      [
        '@nid'  => $subNode->id(),
        '@sub'  => $stripeSubId,
        '@uid'  => $userUid,
        '@plan' => $plan->label(),
        '@end'  => date('Y-m-d H:i', $periodEnd),
      ]
    );

    return $this->corsResponse(new JsonResponse([
      'activated'      => TRUE,
      'subscriptionId' => $subNode->uuid(),
    ], 201));
  }

  /**
   * POST /api/subscription/disable-renewal — authenticated.
   *
   * Body: { subscriptionId: "drupal-node-uuid" }
   *
   * Cancels the Stripe Subscription so it won't renew, but keeps the Drupal
   * subscription node as 'active' so the user retains access until end date.
   * Sets field_auto_renewal = FALSE.
   */
  public function disableRenewal(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['subscriptionId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing subscriptionId'], 400));
    }

    $nodeUuid = $body['subscriptionId'];

    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $nodeUuid, 'type' => 'subscription']);

    if (empty($nodes)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Subscription not found'], 404));
    }

    $node        = reset($nodes);

    // Ownership check — users can only modify their own subscriptions.
    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        // Schedule cancellation at period end (reversible via enable-renewal).
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => TRUE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->warning('Stripe disable-renewal: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

    // Keep subscription active — user retains access until end date.
    $node->set('field_auto_renewal', FALSE);
    $node->save();

    return $this->corsResponse(new JsonResponse(['updated' => TRUE], 200));
  }

  /**
   * POST /api/subscription/enable-renewal — authenticated.
   *
   * Body: { subscriptionId: "drupal-node-uuid" }
   *
   * Re-enables auto-renewal by removing cancel_at_period_end from the Stripe
   * Subscription. Only works if the subscription is still within the period.
   */
  public function enableRenewal(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['subscriptionId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing subscriptionId'], 400));
    }

    $nodeUuid = $body['subscriptionId'];

    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $nodeUuid, 'type' => 'subscription']);

    if (empty($nodes)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Subscription not found'], 404));
    }

    $node        = reset($nodes);

    // Ownership check.
    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    // Guard: only enable renewal if subscription is still within its period.
    // Accepts 'active' (auto-renewal was just disabled) and 'cancelled' (user
    // explicitly cancelled but end_date is still in the future — i.e. they
    // cancelled by accident and want to revert before the period ends).
    $endTs  = (int) ($node->get('field_end_date')->value ?? 0);
    $status = $node->get('field_subscription_status')->value ?? '';
    if (!in_array($status, ['active', 'cancelled']) || $endTs <= time()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Subscription is no longer active'], 409));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => FALSE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->warning('Stripe enable-renewal: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

    // If the subscription was 'cancelled' (user cancelled but period still
    // valid), revert status to 'active' — the Stripe sub is still running
    // with cancel_at_period_end=true which we just removed above.
    if ($status === 'cancelled') {
      $node->set('field_subscription_status', 'active');
    }
    $node->set('field_auto_renewal', TRUE);
    $node->save();

    return $this->corsResponse(new JsonResponse(['updated' => TRUE], 200));
  }

  /**
   * POST /api/subscription/cancel — authenticated.
   *
   * Body: { subscriptionId: "drupal-node-uuid" }
   */
  public function cancel(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['subscriptionId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing subscriptionId'], 400));
    }

    $nodeUuid = $body['subscriptionId'];

    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $nodeUuid, 'type' => 'subscription']);

    if (empty($nodes)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Subscription not found'], 404));
    }

    $node        = reset($nodes);

    // Ownership check.
    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        // Schedule cancellation at period end — the user retains access until
        // end_date and is not charged again. Immediate cancellation would lose
        // the remaining paid time. customer.subscription.deleted fires at
        // period end and marks the node 'expired'.
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => TRUE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->error('Subscription cancel Stripe error: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

    // Mark as cancelled — user explicitly cancelled but retains access until
    // end_date. Cron / customer.subscription.deleted will mark 'expired' after.
    $node->set('field_subscription_status', 'cancelled');
    $node->set('field_auto_renewal', FALSE);
    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription cancelled: node @nid, stripe sub @sub',
      ['@nid' => $node->id(), '@sub' => $stripeSubId]
    );

    return $this->corsResponse(new JsonResponse(['cancelled' => TRUE], 200));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private function getNextBillingDate(string $billingCycle): \DateTime {
    $date = new \DateTime('now');
    if ($billingCycle === 'day') {
      // 'day' is the test plan interval. Use a 2-minute trial so renewals
      // happen quickly in dev without waiting a full day.
      $date->modify('+2 minutes');
    } else {
      // field_billing_cycle values ('month', 'year') are valid PHP modify units.
      $date->modify('+1 ' . $billingCycle);
    }
    return $date;
  }

  private function getCustomerIdFromMeta(\Stripe\PaymentIntent $pi): string {
    $meta = $pi->metadata ?? [];
    if (is_object($meta) && method_exists($meta, 'toArray')) {
      $meta = $meta->toArray();
    }
    return (string) ($meta['customer_id'] ?? '');
  }

  private function getOrCreateStripeCustomer(int $userUid, string $email, string $name): string {
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'       => 'subscription',
        'field_user' => $userUid,
      ]);

    foreach ($existing as $sub) {
      $cid = $sub->get('field_stripe_customer_id')->value ?? '';
      if (!empty($cid)) {
        return $cid;
      }
    }

    $customer = \Stripe\Customer::create([
      'email'    => $email,
      'name'     => $name,
      'metadata' => ['user_uid' => (string) $userUid],
    ]);

    return $customer->id;
  }

  private function getOrCreateStripePrice($plan, string $planUuid, float $price, string $billingCycle): string {
    // field_billing_cycle values ('day', 'month', 'year') map directly to
    // Stripe recurring interval values — no mapping table needed.
    $interval = $billingCycle;

    $prices = \Stripe\Price::all(['active' => TRUE, 'limit' => 10]);
    foreach ($prices->data as $p) {
      $meta = $p->metadata->toArray();
      if (($meta['plan_uuid'] ?? '') === $planUuid && $p->recurring->interval === $interval) {
        return $p->id;
      }
    }

    $newPrice = \Stripe\Price::create([
      'unit_amount'  => (int) round($price * 100),
      'currency'     => 'eur',
      'recurring'    => ['interval' => $interval],
      'product_data' => ['name' => $plan->label()],
      'metadata'     => ['plan_uuid' => $planUuid],
    ]);

    return $newPrice->id;
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
