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
   * Returns: { clientSecret, paymentIntentId, stripeCustomerId }
   *
   * Creates a Stripe Customer (or retrieves existing) and a PaymentIntent
   * for the plan price. The frontend confirms payment with stripe.confirmCardPayment().
   * After confirmation, the frontend calls /api/subscription/activate.
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
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'monthly';

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

      // Get or create a Stripe Customer so we can attach a payment method later.
      $customerId = $this->getOrCreateStripeCustomer($userUid, $userEmail, $userName);

      // Create a PaymentIntent directly — always works regardless of Stripe API version.
      $paymentIntent = \Stripe\PaymentIntent::create([
        'amount'             => (int) round($price * 100),
        'currency'           => 'eur',
        'customer'           => $customerId,
        'setup_future_usage' => 'off_session', // Save PM for recurring charges.
        'metadata'           => [
          'type'          => 'subscription',
          'plan_uuid'     => $planUuid,
          'plan_nid'      => (string) $plan->id(),
          'user_uid'      => (string) $userUid,
          'billing_cycle' => $billingCycle,
          'customer_id'   => $customerId,
        ],
        'description' => 'StepUp Tours — ' . $plan->label() . ' (' . $billingCycle . ')',
      ]);

      return $this->corsResponse(new JsonResponse([
        'clientSecret'     => $paymentIntent->client_secret,
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
   * Body: { paymentIntentId: "pi_...", planId: "uuid", stripeCustomerId: "cus_..." }
   *
   * 1. Verifies PaymentIntent status = succeeded.
   * 2. Attaches the payment method to the Stripe Customer and sets it as default.
   * 3. Creates a Stripe Subscription (trial_end = next billing date) so Stripe
   *    handles future auto-renewals without charging again now.
   * 4. Creates the Drupal subscription node + subscription_payment node.
   */
  public function activate(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['paymentIntentId']) || empty($body['planId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing paymentIntentId or planId'], 400));
    }

    $paymentIntentId = $body['paymentIntentId'];
    $planUuid        = $body['planId'];
    $stripeCustomerId = $body['stripeCustomerId'] ?? '';

    $plans = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $planUuid, 'type' => 'subscription_plan', 'status' => 1]);

    if (empty($plans)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Plan not found'], 404));
    }

    $plan         = reset($plans);
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'monthly';
    $price        = (float) ($plan->get('field_price')->value ?? 0);

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      // ── 1. Verify PaymentIntent ────────────────────────────────────────────
      $paymentIntent = \Stripe\PaymentIntent::retrieve($paymentIntentId);
      if ($paymentIntent->status !== 'succeeded') {
        return $this->corsResponse(new JsonResponse([
          'error' => 'Payment not confirmed (status: ' . $paymentIntent->status . ')',
        ], 402));
      }

      // ── 2. Attach payment method to customer ───────────────────────────────
      $pmId       = is_string($paymentIntent->payment_method)
        ? $paymentIntent->payment_method
        : ($paymentIntent->payment_method->id ?? '');
      $customerId = !empty($stripeCustomerId) ? $stripeCustomerId : $this->getCustomerIdFromMeta($paymentIntent);

      if (!empty($pmId) && !empty($customerId)) {
        try {
          // SDK 19+: attach() is an instance method on the retrieved object.
          $pm = \Stripe\PaymentMethod::retrieve($pmId);
          $pm->attach(['customer' => $customerId]);
        } catch (\Throwable $e) {
          // Already attached or other non-fatal error — safe to ignore.
        }
        \Stripe\Customer::update($customerId, [
          'invoice_settings' => ['default_payment_method' => $pmId],
        ]);
      }

    } catch (\Throwable $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription activate error: @msg in @file:@line', [
        '@msg'  => $e->getMessage(),
        '@file' => $e->getFile(),
        '@line' => $e->getLine(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Failed to verify payment: ' . $e->getMessage()], 500));
    }

    $currentUser = \Drupal::currentUser();
    $userUid     = (int) $currentUser->id();

    // ── Idempotency: skip if this payment already activated a subscription ──
    $existingPayment = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                        => 'subscription_payment',
        'field_stripe_payment_intent' => $paymentIntentId,
      ]);

    if (!empty($existingPayment)) {
      $subNodeId = reset($existingPayment)->get('field_subscription')->target_id ?? 0;
      $subNode   = $subNodeId ? \Drupal::entityTypeManager()->getStorage('node')->load($subNodeId) : NULL;
      if ($subNode) {
        return $this->corsResponse(new JsonResponse(['activated' => TRUE, 'subscriptionId' => $subNode->uuid()], 200));
      }
    }

    // ── Deactivate existing active subscriptions for this user ──────────────
    $activeOthers = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                      => 'subscription',
        'field_user'                => $userUid,
        'field_subscription_status' => 'active',
      ]);
    foreach ($activeOthers as $other) {
      $other->set('field_subscription_status', 'cancelled');
      $other->save();
    }

    // ── Calculate subscription dates ────────────────────────────────────────
    $startDate = new \DateTime('now');
    $endDate   = $this->getNextBillingDate($billingCycle);

    // ── 3. Create Stripe Subscription (trial until next billing date) ────────
    $stripeSubId = '';
    try {
      \Stripe\Stripe::setApiKey($config->get('stripe_secret_key'));
      $priceId = $this->getOrCreateStripePrice($plan, $planUuid, $price, $billingCycle);

      $stripeSub = \Stripe\Subscription::create([
        'customer'  => $customerId,
        'items'     => [['price' => $priceId]],
        'trial_end' => $endDate->getTimestamp(),
        'metadata'  => [
          'plan_uuid' => $planUuid,
          'plan_nid'  => (string) $plan->id(),
          'user_uid'  => (string) $userUid,
        ],
      ]);
      $stripeSubId = $stripeSub->id;
    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->warning('Could not create Stripe Subscription (auto-renewal disabled): @msg', [
        '@msg' => $e->getMessage(),
      ]);
      // Continue — Drupal node is still created, just without auto-renewal.
    }

    // ── 4. Create Drupal subscription node ───────────────────────────────────
    $user = \Drupal\user\Entity\User::load($userUid);
    $name = $user ? $user->getAccountName() : 'user' . $userUid;

    $subNode = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                         => 'subscription',
      'title'                        => 'Subscription ' . $name . ' ' . $startDate->format('Y-m-d'),
      'status'                       => 1,
      'uid'                          => $userUid,
      'field_user'                   => ['target_id' => $userUid],
      'field_plan'                   => ['target_id' => (int) $plan->id()],
      'field_subscription_status'    => 'active',
      'field_start_date'             => $startDate->getTimestamp(),
      'field_end_date'               => $endDate->getTimestamp(),
      'field_auto_renewal'           => TRUE,
      'field_stripe_subscription_id' => $stripeSubId,
      'field_stripe_customer_id'     => $customerId,
    ]);
    $subNode->save();

    // ── 5. Create subscription_payment node for the initial payment ──────────
    $payment = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                        => 'subscription_payment',
      'title'                       => 'Payment ' . $paymentIntentId,
      'status'                      => 1,
      'uid'                         => $userUid,
      'field_subscription'          => ['target_id' => $subNode->id()],
      'field_user'                  => ['target_id' => $userUid],
      'field_plan'                  => ['target_id' => (int) $plan->id()],
      'field_amount'                => (string) $price,
      'field_stripe_invoice_id'     => '',
      'field_stripe_payment_intent' => $paymentIntentId,
      'field_payment_status'        => 'succeed',
      'field_period_start'          => $startDate->getTimestamp(),
      'field_period_end'            => $endDate->getTimestamp(),
    ]);
    $payment->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription activated: node @nid, stripe sub @sub, user @uid, plan @plan until @end',
      [
        '@nid'  => $subNode->id(),
        '@sub'  => $stripeSubId ?: 'none',
        '@uid'  => $userUid,
        '@plan' => $plan->label(),
        '@end'  => $endDate->format('Y-m-d H:i'),
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
    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        // Schedule cancellation at period end — user retains access until endDate.
        // Webhook customer.subscription.deleted will update Drupal status when it fires.
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => TRUE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->error('Subscription cancel Stripe error: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

    // Keep status active — user retains access until endDate.
    // Webhook will set status to 'cancelled' when Stripe period actually ends.
    $node->set('field_auto_renewal', FALSE);
    $node->save();

    return $this->corsResponse(new JsonResponse(['cancelled' => TRUE], 200));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private function getNextBillingDate(string $billingCycle): \DateTime {
    $date = new \DateTime('now');
    switch ($billingCycle) {
      case 'minute':
        $date->modify('+1 minute');
        break;
      case 'annual':
      case 'anually':
        $date->modify('+1 year');
        break;
      default:
        $date->modify('+1 month');
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
    $intervalMap = [
      'monthly' => 'month',
      'annual'  => 'year',
      'anually' => 'year',
      'minute'  => 'day',
    ];
    $interval = $intervalMap[$billingCycle] ?? 'month';

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
