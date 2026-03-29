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

        // invoice_payment.paid is fired by Stripe's newer Invoice Payment API
        // for subscription renewals triggered via billing_cycle_anchor reset or
        // other proration flows. It has a different object structure — we fetch
        // the full Invoice and delegate to the same handler.
        case 'invoice_payment.paid':
          $this->handleInvoicePaymentPaidEvent($event->data->object);
          break;

        case 'invoice.payment_failed':
          $this->handleInvoicePaymentFailed($event->data->object);
          break;

        case 'customer.subscription.deleted':
          $this->handleSubscriptionDeleted($event->data->object);
          break;

        case 'customer.subscription.updated':
          $this->handleSubscriptionUpdated($event->data->object);
          break;

        case 'customer.subscription.trial_will_end':
          // No trials in use — ignore silently.
          break;

        case 'payment_intent.succeeded':
          // Donations only (type != subscription in metadata).
          $pi   = $event->data->object;
          $meta = self::extractMetadata($pi);
          if (($meta['type'] ?? '') !== 'subscription') {
            $this->handlePaymentIntentSucceeded($pi);
          }
          break;

        // Known events that require no action — silence to keep logs clean.
        case 'customer.created':
        case 'customer.updated':
        case 'customer.subscription.created':
        case 'payment_intent.created':
        case 'payment_intent.processing':
        case 'payment_method.attached':
        case 'charge.succeeded':
        case 'charge.updated':
        case 'charge.failed':
        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.paid':
        case 'invoice.upcoming':
        case 'setup_intent.created':
        case 'setup_intent.succeeded':
        case 'invoiceitem.created':
        case 'invoiceitem.updated':
        case 'invoiceitem.deleted':
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
    $amountPaid  = (int) ($invoice->amount_paid ?? 0);

    if (empty($stripeSubId) || empty($invoiceId)) {
      \Drupal::logger('stepuptours_api')->warning('invoice.payment_succeeded: missing subscription or invoice id');
      return;
    }

    // ── Idempotency (paid invoices only — $0 invoices never create payment nodes) ──
    if ($amountPaid > 0) {
      $existingByInvoice = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                    => 'subscription_payment',
          'field_stripe_invoice_id' => $invoiceId,
        ]);

      if (!empty($existingByInvoice)) {
        return;
      }

      $piIdForCheck = is_string($invoice->payment_intent)
        ? $invoice->payment_intent
        : ($invoice->payment_intent->id ?? '');

      if (!empty($piIdForCheck)) {
        $existingByPi = \Drupal::entityTypeManager()
          ->getStorage('node')
          ->loadByProperties([
            'type'                        => 'subscription_payment',
            'field_stripe_payment_intent' => $piIdForCheck,
          ]);

        if (!empty($existingByPi)) {
          // Update with invoice_id so future lookups find it by invoice.
          $existing = reset($existingByPi);
          $existing->set('field_stripe_invoice_id', $invoiceId);
          $existing->save();
          return;
        }
      }
    }

    // ── Retrieve Stripe Subscription (metadata + authoritative period end) ──
    $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
    $meta      = self::extractMetadata($stripeSub);
    $subArr    = $stripeSub->toArray();

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

    $billingCycle = $plan->get('field_billing_cycle')->value ?? 'month';
    $periodStart  = (new \DateTime())->setTimestamp((int) ($invoice->period_start ?? time()));

    // ── Authoritative end date from Stripe Subscription ──────────────────────
    // DO NOT use invoice->period_end: for trial→active invoices it equals
    // trial_end (not trial_end+interval), and for proration invoices it equals
    // the new billing anchor (not anchor+interval).
    // In Stripe API 2024+, current_period_end moved from subscription level to
    // per-item level. Check both.
    $newEndTs = $subArr['current_period_end']
      ?? ($subArr['items']['data'][0]['current_period_end'] ?? NULL);

    // Fallback: add one billing interval to now.
    // field_billing_cycle values ('day', 'month', 'year') are valid PHP modify
    // units — no mapping table needed.
    if (empty($newEndTs)) {
      $newEndTs = (new \DateTime())->modify('+1 ' . $billingCycle)->getTimestamp();
    }

    // ── Find or create the subscription node ──────────────────────────────
    $subNodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (!empty($subNodes)) {
      $subNode           = reset($subNodes);
      $cancelAtPeriodEnd = !empty($subArr['cancel_at_period_end']);

      // Only advance end_date — never go backward.
      $currentEndDate = (int) ($subNode->get('field_end_date')->value ?? 0);
      if ((int) $newEndTs > $currentEndDate) {
        $subNode->set('field_end_date', (int) $newEndTs);
      }

      $subNode->set('field_subscription_status', 'active');
      if (!$cancelAtPeriodEnd) {
        $subNode->set('field_auto_renewal', TRUE);
      }
      $subNode->save();
    } else {
      // $0 invoices (trial period) fire before activate() creates the node.
      // Skip node creation here — activate() is responsible for the initial node.
      // Paid renewal invoices reaching this branch mean activate() was missed
      // (e.g. webhook received before the user completed the flow), so we
      // create the node as a recovery path for paid invoices only.
      if ($amountPaid <= 0) {
        \Drupal::logger('stepuptours_api')->info(
          'Skipping $0 invoice @inv for sub @sub — no node yet, activate() will create it.',
          ['@inv' => $invoiceId, '@sub' => $stripeSubId]
        );
        return;
      }

      // Deactivate any other active subscriptions for this user.
      $activeOthers = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                      => 'subscription',
          'field_user'                => $userUid,
          'field_subscription_status' => 'active',
        ]);

      foreach ($activeOthers as $other) {
        $otherEnd    = (int) ($other->get('field_end_date')->value ?? 0);
        $otherStatus = ($otherEnd > 0 && $otherEnd <= time()) ? 'expired' : 'cancelled';
        $other->set('field_subscription_status', $otherStatus);
        $other->save();
      }

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
        'field_start_date'             => $periodStart->getTimestamp(),
        'field_end_date'               => (int) $newEndTs,
        'field_auto_renewal'           => TRUE,
        'field_stripe_subscription_id' => $stripeSubId,
        'field_stripe_customer_id'     => $customerId,
      ]);
      $subNode->save();
    }

    // ── Skip payment creation for $0 invoices (end_date already synced above) ──
    if ($amountPaid <= 0) {
      \Drupal::logger('stepuptours_api')->info(
        'Synced end_date from $0 invoice @inv for sub @sub (new end: @ts).',
        ['@inv' => $invoiceId, '@sub' => $stripeSubId, '@ts' => date('Y-m-d H:i:s', (int) $newEndTs)]
      );
      return;
    }

    // ── Create subscription_payment node ──────────────────────────────────
    $amount = $amountPaid / 100;
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
      'field_period_end'            => (int) $newEndTs,
    ]);
    $payment->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription payment recorded: invoice @inv for user @uid, amount @amount, end @end',
      ['@inv' => $invoiceId, '@uid' => $userUid, '@amount' => $amount, '@end' => date('Y-m-d H:i:s', (int) $newEndTs)]
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
   *
   * Fired by Stripe when the subscription period ends after cancel_at_period_end
   * or after an immediate cancellation. At this point the user has no active
   * Stripe subscription → mark Drupal node as 'expired' directly.
   *
   * Note: 'cancelled' is only used while the sub is still within its paid period
   * (user clicked cancel but end_date is in the future). Once the period ends
   * Stripe fires this event and we go straight to 'expired'.
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
    $node->set('field_subscription_status', 'expired');
    $node->set('field_auto_renewal', FALSE);
    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription expired via webhook (deleted): @id', ['@id' => $stripeSubId]
    );
  }

  /**
   * customer.subscription.updated
   * Syncs cancel_at_period_end → field_auto_renewal.
   * This fires whenever the Stripe subscription is modified (e.g. renewal
   * toggled on/off). We use it as the authoritative source of truth so that
   * field_auto_renewal stays consistent with Stripe even if the API call
   * succeeded but the direct Drupal update failed.
   */
  private function handleSubscriptionUpdated(object $stripeSub): void {
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
      return;
    }

    $node = reset($nodes);

    // cancel_at_period_end=true means the user disabled auto-renewal.
    $cancelAtPeriodEnd = (bool) ($stripeSub->cancel_at_period_end ?? FALSE);
    $autoRenewal = !$cancelAtPeriodEnd;

    $current = (bool) $node->get('field_auto_renewal')->value;
    if ($current === $autoRenewal) {
      return;
    }

    $node->set('field_auto_renewal', $autoRenewal);
    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Subscription @id auto_renewal synced from Stripe: @val',
      ['@id' => $stripeSubId, '@val' => $autoRenewal ? 'enabled' : 'disabled']
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

  /**
   * invoice_payment.paid
   *
   * Fired by Stripe's newer Invoice Payment API for some billing flows such as
   * billing_cycle_anchor resets (proration invoices). The event data object is
   * an InvoicePayment, not an Invoice — fetch the full Invoice and delegate to
   * the existing handleInvoicePaymentSucceeded() handler.
   *
   * Both invoice.payment_succeeded and invoice_payment.paid may fire for the
   * same underlying invoice in some flows. The idempotency check on
   * field_stripe_invoice_id inside handleInvoicePaymentSucceeded() prevents
   * duplicate subscription_payment nodes.
   */
  private function handleInvoicePaymentPaidEvent(object $invoicePayment): void {
    // The invoice field is either a string ID or an expanded Invoice object.
    $invoiceId = is_string($invoicePayment->invoice ?? NULL)
      ? $invoicePayment->invoice
      : ($invoicePayment->invoice->id ?? '');

    if (empty($invoiceId)) {
      \Drupal::logger('stepuptours_api')->warning(
        'invoice_payment.paid: missing invoice ID in event object.'
      );
      return;
    }

    $config    = \Drupal::config('stepuptours.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';
    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return;
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);
      $invoice = \Stripe\Invoice::retrieve($invoiceId);
      $this->handleInvoicePaymentSucceeded($invoice);
    }
    catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error(
        'invoice_payment.paid: could not process invoice @id — @msg',
        ['@id' => $invoiceId, '@msg' => $e->getMessage()]
      );
    }
  }

}
