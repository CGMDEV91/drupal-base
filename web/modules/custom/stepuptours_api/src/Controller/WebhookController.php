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

    $payload   = $request->getContent();
    $sigHeader = $request->headers->get('Stripe-Signature', '');

    $config        = \Drupal::config('stepuptours.payment');
    $webhookSecret = $config->get('stripe_webhook_secret') ?? '';
    $secretKey     = $config->get('stripe_secret_key') ?? '';

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
      $event       = (object) $data;
      $event->type = $data['type'];
      $event->data = (object) ['object' => (object) ($data['data']['object'] ?? [])];
    }

    try {
      switch ($event->type) {
        case 'invoice.payment_succeeded':
          $this->handleInvoicePaymentSucceeded($event->data->object);
          break;

        case 'invoice.payment_failed':
          $this->handleInvoicePaymentFailed($event->data->object);
          break;

        case 'customer.subscription.deleted':
          $this->handleSubscriptionDeleted($event->data->object);
          break;

        case 'payment_intent.succeeded':
          // Donations only (type != subscription in metadata).
          $pi   = $event->data->object;
          $meta = self::extractMetadata($pi);
          if (($meta['type'] ?? '') !== 'subscription') {
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

  // ── Invoice handlers ────────────────────────────────────────────────────────

  /**
   * invoice.payment_succeeded
   * Creates/updates the subscription node and records a subscription_payment.
   */
  private function handleInvoicePaymentSucceeded(object $invoice): void {
    $stripeSubId = $invoice->subscription ?? '';
    $invoiceId   = $invoice->id ?? '';

    if (empty($stripeSubId) || empty($invoiceId)) {
      \Drupal::logger('stepuptours_api')->warning('invoice.payment_succeeded: missing subscription or invoice id');
      return;
    }

    // Idempotency: skip if payment already recorded.
    $existingPayment = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'subscription_payment',
        'field_stripe_invoice_id' => $invoiceId,
      ]);

    if (!empty($existingPayment)) {
      return;
    }

    // Retrieve full Stripe Subscription to get metadata.
    $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
    $meta      = self::extractMetadata($stripeSub);

    $planNid    = (int) ($meta['plan_nid'] ?? 0);
    $userUid    = (int) ($meta['user_uid'] ?? 0);
    $customerId = $invoice->customer ?? '';

    if ($planNid === 0 || $userUid === 0) {
      \Drupal::logger('stepuptours_api')->warning('invoice.payment_succeeded: missing plan_nid or user_uid in Stripe metadata');
      return;
    }

    $plan = \Drupal::entityTypeManager()->getStorage('node')->load($planNid);
    if (!$plan) {
      \Drupal::logger('stepuptours_api')->error('invoice.payment_succeeded: plan @nid not found', ['@nid' => $planNid]);
      return;
    }

    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'monthly';
    $periodStart  = (new \DateTime())->setTimestamp((int) ($invoice->period_start ?? time()));
    $periodEnd    = (new \DateTime())->setTimestamp((int) ($invoice->period_end ?? time()));

    // ── Find or create the subscription node ──────────────────────────────
    $subNodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (!empty($subNodes)) {
      // Update existing: extend endDate, ensure active.
      $subNode = reset($subNodes);
      $subNode->set('field_end_date', $periodEnd->format('Y-m-d\TH:i:s'));
      $subNode->set('field_subscription_status', 'active');
      $subNode->set('field_auto_renewal', TRUE);
      $subNode->save();
    } else {
      // Deactivate any other active subscriptions for this user.
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

      // Create new subscription node.
      $user = \Drupal\user\Entity\User::load($userUid);
      $name = $user ? $user->getAccountName() : 'user' . $userUid;

      $subNode = \Drupal::entityTypeManager()->getStorage('node')->create([
        'type'                         => 'subscription',
        'title'                        => 'Subscription ' . $name . ' ' . $periodStart->format('Y-m-d'),
        'status'                       => 1,
        'uid'                          => $userUid,
        'field_user'                   => ['target_id' => $userUid],
        'field_plan'                   => ['target_id' => $planNid],
        'field_subscription_status'    => 'active',
        'field_start_date'             => $periodStart->format('Y-m-d\TH:i:s'),
        'field_end_date'               => $periodEnd->format('Y-m-d\TH:i:s'),
        'field_auto_renewal'           => TRUE,
        'field_stripe_subscription_id' => $stripeSubId,
        'field_stripe_customer_id'     => $customerId,
      ]);
      $subNode->save();
    }

    // ── Create subscription_payment node ──────────────────────────────────
    $amount = ($invoice->amount_paid ?? 0) / 100;
    $piId   = is_string($invoice->payment_intent)
      ? $invoice->payment_intent
      : ($invoice->payment_intent->id ?? '');

    $payment = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                        => 'subscription_payment',
      'title'                       => 'Payment ' . $invoiceId,
      'status'                      => 1,
      'uid'                         => $userUid,
      'field_subscription'          => ['target_id' => $subNode->id()],
      'field_user'                  => ['target_id' => $userUid],
      'field_plan'                  => ['target_id' => $planNid],
      'field_amount'                => (string) $amount,
      'field_stripe_invoice_id'     => $invoiceId,
      'field_stripe_payment_intent' => $piId,
      'field_payment_status'        => 'succeed',
      'field_period_start'          => $periodStart->getTimestamp(),
      'field_period_end'            => $periodEnd->getTimestamp(),
    ]);
    $payment->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription payment recorded: invoice @inv for user @uid, amount @amount',
      ['@inv' => $invoiceId, '@uid' => $userUid, '@amount' => $amount]
    );
  }

  /**
   * invoice.payment_failed
   * Records a failed payment. Does not modify subscription status yet
   * (Stripe will retry and eventually fire customer.subscription.deleted).
   */
  private function handleInvoicePaymentFailed(object $invoice): void {
    $stripeSubId = $invoice->subscription ?? '';
    $invoiceId   = $invoice->id ?? '';

    if (empty($invoiceId)) {
      return;
    }

    // Idempotency.
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'subscription_payment',
        'field_stripe_invoice_id' => $invoiceId,
      ]);

    if (!empty($existing)) {
      return;
    }

    // Get metadata from Stripe Subscription.
    $userUid = 0;
    $planNid = 0;
    if (!empty($stripeSubId)) {
      try {
        $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
        $meta      = self::extractMetadata($stripeSub);
        $userUid   = (int) ($meta['user_uid'] ?? 0);
        $planNid   = (int) ($meta['plan_nid'] ?? 0);
      } catch (\Exception $e) {
        // Continue even if we can't retrieve metadata.
      }
    }

    $periodStart = (new \DateTime())->setTimestamp((int) ($invoice->period_start ?? time()));
    $periodEnd   = (new \DateTime())->setTimestamp((int) ($invoice->period_end ?? time()));
    $amount      = ($invoice->amount_due ?? 0) / 100;
    $piId        = is_string($invoice->payment_intent)
      ? $invoice->payment_intent
      : ($invoice->payment_intent->id ?? '');

    // Find subscription node to link to.
    $subNodeId = NULL;
    if (!empty($stripeSubId)) {
      $subNodes = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                         => 'subscription',
          'field_stripe_subscription_id' => $stripeSubId,
        ]);
      if (!empty($subNodes)) {
        $subNode   = reset($subNodes);
        $subNodeId = $subNode->id();

        // Mark as past_due.
        $subNode->set('field_subscription_status', 'past_due');
        $subNode->save();
      }
    }

    $fields = [
      'type'                        => 'subscription_payment',
      'title'                       => 'Failed Payment ' . $invoiceId,
      'status'                      => 1,
      'field_stripe_invoice_id'     => $invoiceId,
      'field_stripe_payment_intent' => $piId,
      'field_payment_status'        => 'failed',
      'field_amount'                => (string) $amount,
      'field_period_start'          => $periodStart->getTimestamp(),
      'field_period_end'            => $periodEnd->getTimestamp(),
    ];

    if ($subNodeId) {
      $fields['field_subscription'] = ['target_id' => $subNodeId];
    }
    if ($userUid > 0) {
      $fields['uid']         = $userUid;
      $fields['field_user']  = ['target_id' => $userUid];
    }
    if ($planNid > 0) {
      $fields['field_plan'] = ['target_id' => $planNid];
    }

    $payment = \Drupal::entityTypeManager()->getStorage('node')->create($fields);
    $payment->save();

    \Drupal::logger('stepuptours_api')->warning(
      'Subscription payment failed: invoice @inv', ['@inv' => $invoiceId]
    );
  }

  /**
   * customer.subscription.deleted
   * Marks the Drupal subscription node as cancelled.
   */
  private function handleSubscriptionDeleted(object $stripeSub): void {
    $stripeSubId = $stripeSub->id ?? '';
    if (empty($stripeSubId)) {
      return;
    }

    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (empty($nodes)) {
      \Drupal::logger('stepuptours_api')->info(
        'customer.subscription.deleted: no Drupal node for @id', ['@id' => $stripeSubId]
      );
      return;
    }

    $node = reset($nodes);
    $node->set('field_subscription_status', 'cancelled');
    $node->set('field_auto_renewal', FALSE);
    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription cancelled via webhook: @id', ['@id' => $stripeSubId]
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Safely extract metadata from a Stripe object.
   * Handles both StripeObject (SDK) and plain stdClass/array (dev mode).
   */
  private static function extractMetadata(object $stripeObject): array {
    $meta = $stripeObject->metadata ?? [];

    if (is_object($meta) && method_exists($meta, 'toArray')) {
      return $meta->toArray();
    }

    return (array) $meta;
  }

  /**
   * Handle successful PaymentIntent for donations.
   */
  private function handlePaymentIntentSucceeded(object $paymentIntent): void {
    $metadata = self::extractMetadata($paymentIntent);

    $tourNid         = $metadata['tour_nid'] ?? '';
    $donorUid        = $metadata['donor_uid'] ?? '';
    $guideRevenue    = $metadata['guide_revenue'] ?? '0';
    $platformRevenue = $metadata['platform_revenue'] ?? '0';
    $currencyCode    = $metadata['currency_code'] ?? 'EUR';

    if (empty($tourNid) || empty($donorUid)) {
      \Drupal::logger('stepuptours_api')->warning(
        'Webhook: missing metadata in payment_intent.succeeded. meta: @m',
        ['@m' => json_encode($metadata)]
      );
      return;
    }

    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'donation',
        'field_payment_reference' => $paymentIntent->id,
      ]);

    if (!empty($existing)) {
      return;
    }

    $amount = ($paymentIntent->amount ?? 0) / 100;

    $node = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                    => 'donation',
      'title'                   => 'Donation ' . $paymentIntent->id,
      'status'                  => 1,
      'uid'                     => (int) $donorUid,
      'field_tour'              => ['target_id' => (int) $tourNid],
      'field_user'              => ['target_id' => (int) $donorUid],
      'field_amount'            => (string) $amount,
      'field_guide_revenue'     => (string) $guideRevenue,
      'field_platform_revenue'  => (string) $platformRevenue,
      'field_payment_reference' => $paymentIntent->id,
      'field_currency_code'     => $currencyCode,
    ]);

    $node->save();

    \Drupal::logger('stepuptours_api')->info('Donation created: @nid for tour @tour, amount @amount', [
      '@nid'    => $node->id(),
      '@tour'   => $tourNid,
      '@amount' => $amount,
    ]);
  }

}
