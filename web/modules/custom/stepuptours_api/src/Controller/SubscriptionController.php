<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Subscription endpoints.
 *
 * NEW FLOW (Checkout Sessions API — mode=subscription, ui_mode=elements):
 * ────────────────────────────────────────────────────────────────────────
 * POST /api/subscription/create
 *   Creates a Stripe CheckoutSession (mode=subscription, ui_mode=elements).
 *   Returns { clientSecret } — the CheckoutSession client_secret, NOT a
 *   PaymentIntent client_secret. The frontend uses CheckoutElementsProvider
 *   with this secret and calls checkout.confirm() to complete payment.
 *
 * POST /api/subscription/session-status
 *   Polling/verification endpoint. Returns the CheckoutSession status after
 *   the frontend redirects back. Used to confirm the subscription is active
 *   and to display a success screen.
 *
 * POST /api/subscription/disable-renewal  — toggle cancel_at_period_end=true
 * POST /api/subscription/enable-renewal   — toggle cancel_at_period_end=false
 * POST /api/subscription/cancel           — cancel immediately at period end
 *
 * Drupal node creation is now fully handled by the webhook
 * (checkout.session.completed + invoice.payment_succeeded as fallback).
 * The session-status endpoint only reads/returns data; it does not create nodes.
 */
class SubscriptionController extends ControllerBase {

  /**
   * POST /api/subscription/create — authenticated.
   *
   * Body: { planId: "uuid" }
   * Returns: { clientSecret, checkoutSessionId }
   *
   * Creates a Stripe CheckoutSession with:
   *   - mode: subscription
   *   - ui_mode: elements  (embedded — no redirect to Stripe-hosted page)
   *   - customer: existing or new Stripe customer for this user
   *   - line_items: the recurring price for the selected plan
   *   - metadata on the session AND subscription_data[metadata] so both the
   *     checkout.session.completed event and the Subscription object carry
   *     plan_nid + user_uid for the webhook handler.
   *
   * No PaymentIntent is created manually. No trial_end hack. Stripe handles
   * the initial payment atomically as part of subscription creation.
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
    $billingCycle = $plan->get('field_billing_cycle')->value;

    if ($price <= 0) {
      return $this->corsResponse(new JsonResponse(['error' => 'Free plans do not require payment'], 400));
    }

    $config    = \Drupal::config('stepuptours_api.payment');
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

      // ── Guard: reject if user already has a non-expired active subscription ──
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

      // Shared metadata for both the CheckoutSession object and the
      // Subscription object (via subscription_data[metadata]).
      // This ensures the webhook can read plan_nid + user_uid from whichever
      // object it receives (checkout.session.completed or invoice events).
      $sharedMeta = [
        'plan_uuid'     => $planUuid,
        'plan_nid'      => (string) $plan->id(),
        'user_uid'      => (string) $userUid,
        'billing_cycle' => $billingCycle,
        'customer_id'   => $customerId,
      ];

      // The return_url is required even in ui_mode=elements. After
      // checkout.confirm() on the frontend, Stripe may redirect here for
      // 3DS / bank-redirect payment methods. For card payments it typically
      // resolves inline without a redirect. The {CHECKOUT_SESSION_ID} template
      // variable is replaced by Stripe before the redirect occurs.
      $origin = $request->headers->get('Origin', '');
      $allowedOrigins = ['http://localhost:8081', 'http://localhost:19006', 'https://app.stepuptours.com'];
      $appBaseUrl = in_array($origin, $allowedOrigins, true)
        ? $origin
        : ($config->get('app_base_url') ?? 'https://app.stepuptours.com');
      $langcode  = \Drupal::languageManager()->getCurrentLanguage()->getId();
      $returnUrl = rtrim($appBaseUrl, '/') . '/' . $langcode . '/subscription/complete?session_id={CHECKOUT_SESSION_ID}';

      $checkoutSession = \Stripe\Checkout\Session::create([
        'mode'             => 'subscription',
        'ui_mode'          => 'embedded',
        'customer'         => $customerId,
        'customer_email'   => empty($customerId) ? $userEmail : NULL,
        'payment_method_types' => ['card'],
        'line_items'       => [
          [
            'price'    => $priceId,
            'quantity' => 1,
          ],
        ],
        // Session-level metadata: available in checkout.session.completed.
        'metadata'         => $sharedMeta,
        // Subscription-level metadata: propagated to the Subscription object,
        // available in invoice events and subscription update events.
        'subscription_data' => [
          'metadata' => $sharedMeta,
        ],
        'return_url'       => $returnUrl,
      ]);

      return $this->corsResponse(new JsonResponse([
        'clientSecret'      => $checkoutSession->client_secret,
        'checkoutSessionId' => $checkoutSession->id,
      ], 200));

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription create error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Payment processing error: ' . $e->getMessage()], 500));
    }
  }

  /**
   * POST /api/subscription/session-status — authenticated.
   *
   * Body: { sessionId: "cs_xxx" }
   *
   * Called by the frontend after the payment flow completes (either via the
   * return_url redirect or after checkout.confirm() resolves inline).
   * Returns the CheckoutSession status so the frontend can show success/error.
   *
   * NOTE: Drupal node creation is NOT done here. It is done by the webhook
   * (checkout.session.completed). This endpoint is read-only.
   */
  public function sessionStatus(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['sessionId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing sessionId'], 400));
    }

    $sessionId = $body['sessionId'];

    $config    = \Drupal::config('stepuptours_api.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);
      $session = \Stripe\Checkout\Session::retrieve($sessionId);

      return $this->corsResponse(new JsonResponse([
        'status'         => $session->status,           // 'open' | 'complete' | 'expired'
        'paymentStatus'  => $session->payment_status,   // 'paid' | 'unpaid' | 'no_payment_required'
        'subscriptionId' => is_string($session->subscription ?? NULL)
          ? $session->subscription
          : ($session->subscription->id ?? NULL),
        'customerId'     => is_string($session->customer ?? NULL)
          ? $session->customer
          : ($session->customer->id ?? NULL),
      ], 200));

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Session status error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Could not retrieve session status'], 500));
    }
  }

  /**
   * POST /api/subscription/disable-renewal — authenticated.
   *
   * Body: { subscriptionId: "drupal-node-uuid" }
   *
   * Sets cancel_at_period_end=true on the Stripe Subscription so it won't
   * renew, but keeps the Drupal node as 'active' until the end date.
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

    $node = reset($nodes);

    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';
    $config      = \Drupal::config('stepuptours_api.payment');
    $secretKey   = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => TRUE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->warning('Stripe disable-renewal: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

    $node->set('field_auto_renewal', FALSE);
    $node->save();

    return $this->corsResponse(new JsonResponse(['updated' => TRUE], 200));
  }

  /**
   * POST /api/subscription/enable-renewal — authenticated.
   *
   * Body: { subscriptionId: "drupal-node-uuid" }
   *
   * Removes cancel_at_period_end from the Stripe Subscription to re-enable
   * auto-renewal. Only works while the subscription is still within its period.
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

    $node = reset($nodes);

    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $endTs  = (int) ($node->get('field_end_date')->value ?? 0);
    $status = $node->get('field_subscription_status')->value ?? '';
    if (!in_array($status, ['active', 'cancelled']) || $endTs <= time()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Subscription is no longer active'], 409));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';
    $config      = \Drupal::config('stepuptours_api.payment');
    $secretKey   = $config->get('stripe_secret_key') ?? '';

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
   *
   * Sets cancel_at_period_end=true and marks the local node as 'cancelled'.
   * Access continues until the end date; Stripe fires customer.subscription.deleted
   * at period end, which transitions the node to 'expired'.
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

    $node = reset($nodes);

    $currentUserId = (int) \Drupal::currentUser()->id();
    if ((int) $node->get('field_user')->target_id !== $currentUserId) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $stripeSubId = $node->get('field_stripe_subscription_id')->value ?? '';
    $config      = \Drupal::config('stepuptours_api.payment');
    $secretKey   = $config->get('stripe_secret_key') ?? '';

    if (!empty($stripeSubId) && !empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
      try {
        \Stripe\Stripe::setApiKey($secretKey);
        \Stripe\Subscription::update($stripeSubId, ['cancel_at_period_end' => TRUE]);
      } catch (\Exception $e) {
        \Drupal::logger('stepuptours_api')->error('Subscription cancel Stripe error: @msg', [
          '@msg' => $e->getMessage(),
        ]);
      }
    }

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

  /**
   * Get an existing Stripe Customer ID for this user or create a new one.
   * Looks up existing subscription nodes before creating a new customer.
   */
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

  /**
   * Get an existing active Stripe Price for this plan or create a new one.
   *
   * Uses metadata[plan_uuid] to find the exact price so we don't create
   * duplicates. Searches with a large enough limit to cover real-world
   * catalogs (up to 100 prices).
   */
  private function getOrCreateStripePrice($plan, string $planUuid, float $price, string $billingCycle): string {
    // field_billing_cycle values ('day', 'month', 'year') map directly to
    // Stripe recurring interval values.
    $interval = $billingCycle;

    // Search in batches of 100 to avoid the limit=10 bug.
    $hasMore      = TRUE;
    $startingAfter = NULL;

    while ($hasMore) {
      $params = ['active' => TRUE, 'limit' => 100];
      if ($startingAfter) {
        $params['starting_after'] = $startingAfter;
      }

      $prices = \Stripe\Price::all($params);

      foreach ($prices->data as $p) {
        if (empty($p->recurring)) {
          continue;
        }
        $meta = $p->metadata->toArray();
        if (($meta['plan_uuid'] ?? '') === $planUuid && $p->recurring->interval === $interval) {
          return $p->id;
        }
        $startingAfter = $p->id;
      }

      $hasMore = $prices->has_more;
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
