<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Stripe webhook handler.
 * POST /api/payment/webhook
 */
class WebhookController extends ControllerBase {

  public function handle(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return new JsonResponse(NULL, 204);
    }

    $payload = $request->getContent();
    $sigHeader = $request->headers->get('Stripe-Signature', '');

    $config = \Drupal::config('stepuptours.payment');
    $webhookSecret = $config->get('stripe_webhook_secret') ?? '';
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      \Drupal::logger('stepuptours_api')->warning('Webhook received but Stripe not configured');
      return new JsonResponse(['error' => 'Stripe not configured'], 503);
    }

    \Stripe\Stripe::setApiKey($secretKey);

    // Verify webhook signature if secret is configured.
    $event = NULL;
    if (!empty($webhookSecret) && $webhookSecret !== 'whsec_PLACEHOLDER') {
      try {
        $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
      } catch (\Stripe\Exception\SignatureVerificationException $e) {
        \Drupal::logger('stepuptours_api')->error('Webhook signature verification failed: @msg', [
          '@msg' => $e->getMessage(),
        ]);
        return new JsonResponse(['error' => 'Invalid signature'], 400);
      }
    } else {
      // No webhook secret configured — parse payload directly (dev mode).
      $data = json_decode($payload, TRUE);
      if (!$data || !isset($data['type'])) {
        return new JsonResponse(['error' => 'Invalid payload'], 400);
      }
      $event = (object) $data;
      $event->type = $data['type'];
      $event->data = (object) ['object' => (object) ($data['data']['object'] ?? [])];
    }

    try {
      switch ($event->type) {
        case 'payment_intent.succeeded':
          $pi   = $event->data->object;
          $meta = (array) ($pi->metadata ?? []);
          $type = $meta['type'] ?? 'donation';

          if ($type === 'subscription') {
            $this->handleSubscriptionPaymentSucceeded($pi);
          } else {
            $this->handlePaymentIntentSucceeded($pi);
          }
          break;

        default:
          \Drupal::logger('stepuptours_api')->info('Unhandled webhook event: @type', [
            '@type' => $event->type,
          ]);
      }
    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Webhook processing error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return new JsonResponse(['error' => 'Processing error'], 500);
    }

    return new JsonResponse(['received' => TRUE], 200);
  }

  /**
   * Handle subscription payment: create or verify subscription node.
   * Mirrors SubscriptionController::activate() — idempotent by payment reference.
   */
  private function handleSubscriptionPaymentSucceeded(object $paymentIntent): void {
    $metadata = (array) ($paymentIntent->metadata ?? []);

    $planNid      = $metadata['plan_nid'] ?? '';
    $userUid      = (int) ($metadata['user_uid'] ?? 0);
    $billingCycle = $metadata['billing_cycle'] ?? 'monthly';
    $autoRenewal  = ($metadata['auto_renewal'] ?? 'false') === 'true';

    if (empty($planNid) || $userUid === 0) {
      \Drupal::logger('stepuptours_api')->warning('Webhook subscription: missing metadata in payment_intent.succeeded');
      return;
    }

    // Idempotency check.
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'subscription',
        'field_payment_reference' => $paymentIntent->id,
      ]);

    if (!empty($existing)) {
      \Drupal::logger('stepuptours_api')->info('Webhook subscription: duplicate @id, skipping', [
        '@id' => $paymentIntent->id,
      ]);
      return;
    }

    $plan = \Drupal::entityTypeManager()->getStorage('node')->load((int) $planNid);
    if (!$plan) {
      \Drupal::logger('stepuptours_api')->error('Webhook subscription: plan @nid not found', ['@nid' => $planNid]);
      return;
    }

    // Deactivate existing active subscriptions for this user.
    $active = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                      => 'subscription',
        'field_user'                => $userUid,
        'field_subscription_status' => 'active',
      ]);

    foreach ($active as $sub) {
      $sub->set('field_subscription_status', 'cancelled');
      $sub->save();
    }

    $startDate = new \DateTime('today');
    $endDate   = clone $startDate;
    $billingCycle === 'annual' ? $endDate->modify('+1 year') : $endDate->modify('+1 month');

    $user = \Drupal\user\Entity\User::load($userUid);
    $name = $user ? $user->getAccountName() : 'user' . $userUid;

    $node = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                      => 'subscription',
      'title'                     => 'Subscription ' . $name . ' ' . $startDate->format('Y-m-d'),
      'status'                    => 1,
      'uid'                       => $userUid,
      'field_user'                => ['target_id' => $userUid],
      'field_plan'                => ['target_id' => (int) $plan->id()],
      'field_subscription_status' => 'active',
      'field_start_date'          => $startDate->format('Y-m-d'),
      'field_end_date'            => $endDate->format('Y-m-d'),
      'field_auto_renewal'        => $autoRenewal,
      'field_last_payment_at'     => (new \DateTime())->format('Y-m-d\TH:i:s'),
      'field_payment_reference'   => $paymentIntent->id,
    ]);

    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Webhook subscription created: @nid for user @uid until @end',
      ['@nid' => $node->id(), '@uid' => $userUid, '@end' => $endDate->format('Y-m-d')]
    );
  }

  /**
   * Handle successful payment: create a donation node.
   */
  private function handlePaymentIntentSucceeded(object $paymentIntent): void {
    $metadata = (array) ($paymentIntent->metadata ?? []);

    $tourNid         = $metadata['tour_nid'] ?? '';
    $donorUid        = $metadata['donor_uid'] ?? '';
    $guideRevenue    = $metadata['guide_revenue'] ?? '0';
    $platformRevenue = $metadata['platform_revenue'] ?? '0';
    $currencyCode    = $metadata['currency_code'] ?? 'EUR';

    if (empty($tourNid) || empty($donorUid)) {
      \Drupal::logger('stepuptours_api')->warning('Webhook: missing metadata in payment_intent.succeeded');
      return;
    }

    // Check for duplicate (same payment reference).
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'donation',
        'field_payment_reference' => $paymentIntent->id,
      ]);

    if (!empty($existing)) {
      \Drupal::logger('stepuptours_api')->info('Webhook: duplicate payment_intent @id, skipping', [
        '@id' => $paymentIntent->id,
      ]);
      return;
    }

    $amount = ($paymentIntent->amount ?? 0) / 100; // cents → euros

    // Create donation node.
    $node = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                   => 'donation',
      'title'                  => 'Donation ' . $paymentIntent->id,
      'status'                 => 1,
      'uid'                    => (int) $donorUid,
      'field_tour'             => ['target_id' => (int) $tourNid],
      'field_user'             => ['target_id' => (int) $donorUid],
      'field_amount'           => (string) $amount,
      'field_guide_revenue'    => (string) $guideRevenue,
      'field_platform_revenue' => (string) $platformRevenue,
      'field_payment_reference'=> $paymentIntent->id,
      'field_currency_code'    => $currencyCode,
    ]);

    $node->save();

    \Drupal::logger('stepuptours_api')->info('Donation created: @nid for tour @tour, amount @amount', [
      '@nid'    => $node->id(),
      '@tour'   => $tourNid,
      '@amount' => $amount,
    ]);
  }

}
