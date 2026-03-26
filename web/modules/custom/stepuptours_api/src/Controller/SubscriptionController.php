<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Subscription endpoints: intent creation + activation.
 *
 * POST /api/subscription/intent   — create Stripe PaymentIntent for a plan
 * POST /api/subscription/activate — verify payment and create subscription node
 */
class SubscriptionController extends ControllerBase {

  /**
   * POST /api/subscription/intent — authenticated.
   *
   * Body: { planId: "uuid", autoRenewal: true }
   * Returns: { clientSecret, paymentIntentId, planTitle, price, billingCycle }
   */
  public function intent(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['planId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing planId'], 400));
    }

    $planId     = $body['planId'];
    $autoRenewal = !empty($body['autoRenewal']);

    // Load plan node by UUID.
    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $planId, 'type' => 'subscription_plan', 'status' => 1]);

    if (empty($nodes)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Plan not found'], 404));
    }

    $plan = reset($nodes);
    $price = (float) ($plan->get('field_price')->value ?? 0);
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'monthly';

    if ($price <= 0) {
      return $this->corsResponse(new JsonResponse(['error' => 'Free plans do not require payment'], 400));
    }

    $config = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      $currentUser = \Drupal::currentUser();
      $userUid = (string) $currentUser->id();

      $paymentIntent = \Stripe\PaymentIntent::create([
        'amount'   => (int) round($price * 100), // cents
        'currency' => 'eur',
        'metadata' => [
          'type'          => 'subscription',
          'plan_id'       => $planId,
          'plan_nid'      => (string) $plan->id(),
          'user_uid'      => $userUid,
          'billing_cycle' => $billingCycle,
          'auto_renewal'  => $autoRenewal ? 'true' : 'false',
        ],
        'description' => 'StepUp Tours — ' . $plan->label() . ' (' . $billingCycle . ')',
      ]);

      return $this->corsResponse(new JsonResponse([
        'clientSecret'    => $paymentIntent->client_secret,
        'paymentIntentId' => $paymentIntent->id,
        'planTitle'       => $plan->label(),
        'price'           => $price,
        'billingCycle'    => $billingCycle,
      ], 200));

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription PaymentIntent error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Payment processing error'], 500));
    }
  }

  /**
   * POST /api/subscription/activate — authenticated.
   *
   * Body: { paymentIntentId: "pi_...", planId: "uuid", autoRenewal: true }
   * Verifies the PaymentIntent status via Stripe, then creates the subscription node.
   * Idempotent: if the node already exists (webhook beat us to it) returns it.
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
    $planId          = $body['planId'];
    $autoRenewal     = !empty($body['autoRenewal']);

    // Load plan node.
    $plans = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $planId, 'type' => 'subscription_plan', 'status' => 1]);

    if (empty($plans)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Plan not found'], 404));
    }
    $plan = reset($plans);
    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'monthly';

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      // Retrieve and verify PaymentIntent from Stripe.
      $paymentIntent = \Stripe\PaymentIntent::retrieve($paymentIntentId);
      if ($paymentIntent->status !== 'succeeded') {
        return $this->corsResponse(new JsonResponse([
          'error' => 'Payment not confirmed (status: ' . $paymentIntent->status . ')',
        ], 402));
      }

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Subscription activate Stripe error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Failed to verify payment'], 500));
    }

    $currentUser = \Drupal::currentUser();
    $userUid     = (int) $currentUser->id();

    // Idempotency: check if subscription already created (e.g. by webhook).
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'subscription',
        'field_payment_reference' => $paymentIntentId,
      ]);

    if (!empty($existing)) {
      $sub = reset($existing);
      return $this->corsResponse(new JsonResponse($this->formatSubscription($sub, $plan), 200));
    }

    // Deactivate any existing active subscriptions for this user.
    $activeSubscriptions = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                       => 'subscription',
        'field_user'                 => $userUid,
        'field_subscription_status'  => 'active',
      ]);

    foreach ($activeSubscriptions as $activeSub) {
      $activeSub->set('field_subscription_status', 'cancelled');
      $activeSub->save();
    }

    // Calculate subscription dates.
    $startDate = new \DateTime('now');
    $endDate   = clone $startDate;

    switch ($billingCycle) {
      case 'minute':
        $endDate->modify('+1 minute');
        break;

      case 'anually':
      case 'annual':
        $endDate->modify('+1 year');
        break;

      default: // monthly
        $endDate->modify('+1 month');
        break;
    }

    // Create subscription node.
    $node = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                      => 'subscription',
      'title'                     => 'Subscription ' . $currentUser->getAccountName() . ' ' . $startDate->format('Y-m-d'),
      'status'                    => 1,
      'uid'                       => $userUid,
      'field_user'                => ['target_id' => $userUid],
      'field_plan'                => ['target_id' => (int) $plan->id()],
      'field_subscription_status' => 'active',
      'field_start_date'          => $startDate->format('Y-m-d\TH:i:s'),
      'field_end_date'            => $endDate->format('Y-m-d\TH:i:s'),
      'field_auto_renewal'        => $autoRenewal,
      'field_last_payment_at'     => (new \DateTime())->format('Y-m-d\TH:i:s'),
      'field_payment_reference'   => $paymentIntentId,
    ]);

    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription created: @nid for user @uid plan @plan until @end',
      [
        '@nid'  => $node->id(),
        '@uid'  => $userUid,
        '@plan' => $plan->label(),
        '@end'  => $endDate->format('Y-m-d'),
      ]
    );

    return $this->corsResponse(new JsonResponse($this->formatSubscription($node, $plan), 201));
  }

  /**
   * Formats a subscription node for the API response.
   */
  private function formatSubscription($node, $plan): array {
    return [
      'id'           => $node->uuid(),
      'status'       => $node->get('field_subscription_status')->value,
      'startDate'    => $node->get('field_start_date')->value,
      'endDate'      => $node->get('field_end_date')->value,
      'autoRenewal'  => (bool) $node->get('field_auto_renewal')->value,
      'planId'       => $plan->uuid(),
      'planTitle'    => $plan->label(),
      'billingCycle' => $plan->get('field_billing_cycle')->value,
      'price'        => (float) ($plan->get('field_price')->value ?? 0),
    ];
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
