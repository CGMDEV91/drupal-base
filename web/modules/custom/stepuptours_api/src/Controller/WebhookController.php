<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Stripe webhook handler.
 * POST /api/payment/webhook
 *
 * NEW FLOW (Checkout Sessions API):
 * ─────────────────────────────────
 * The primary event for subscription creation is now checkout.session.completed.
 * When mode=subscription, the session object contains:
 *   - session->subscription  (Stripe sub ID)
 *   - session->customer      (Stripe customer ID)
 *   - session->metadata      (plan_nid, user_uid set on the CheckoutSession)
 *   - session->subscription_data->metadata propagated to the Subscription object
 *
 * Renewals are handled by invoice.payment_succeeded as before (no change there).
 * The old PaymentIntent-based first-payment flow and the trial_end hack are gone.
 */
class WebhookController extends ControllerBase {

  public function handle(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return new JsonResponse(NULL, 204);
    }

    $payload   = $request->getContent();
    $sigHeader = $request->headers->get('Stripe-Signature', '');

    $config        = \Drupal::config('stepuptours_api.payment');
    $webhookSecret = $config->get('stripe_webhook_secret') ?? '';
    $secretKey     = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      \Drupal::logger('stepuptours_api')->warning('Webhook received but Stripe not configured');
      return new JsonResponse(['error' => 'Stripe not configured'], 503);
    }

    \Stripe\Stripe::setApiKey($secretKey);

    // ── Verify webhook signature ───────────────────────────────────────────
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
      // No webhook secret configured — parse payload directly (dev/test mode).
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

        // ── PRIMARY: Checkout Session completed ──────────────────────────
        // Fired once when a customer finishes a Checkout Session.
        // For mode=subscription this is the authoritative event for creating
        // Drupal subscription and subscription_payment nodes.
        case 'checkout.session.completed':
          $this->handleCheckoutSessionCompleted($event->data->object);
          break;

        // ── RENEWAL: Invoice payment succeeded ──────────────────────────
        // Fired on every subsequent billing cycle renewal.
        // The first invoice is also covered here as a safe fallback thanks
        // to idempotency checks — whichever handler runs first wins.
        case 'invoice.payment_succeeded':
          $this->handleInvoicePaymentSucceeded($event->data->object);
          break;

        // ── RENEWAL ALTERNATIVE (newer Stripe billing flows) ─────────────
        case 'invoice_payment.paid':
          $this->handleInvoicePaymentPaidEvent($event->data->object);
          break;

        // ── FAILED PAYMENT ───────────────────────────────────────────────
        case 'invoice.payment_failed':
          $this->handleInvoicePaymentFailed($event->data->object);
          break;

        // ── SUBSCRIPTION LIFECYCLE ───────────────────────────────────────
        case 'customer.subscription.deleted':
          $this->handleSubscriptionDeleted($event->data->object);
          break;

        case 'customer.subscription.updated':
          $this->handleSubscriptionUpdated($event->data->object);
          break;

        case 'customer.subscription.trial_will_end':
          // No trials in use — ignore silently.
          break;

        // ── ONE-TIME DONATIONS ───────────────────────────────────────────
        // Only handle payment_intent.succeeded when metadata explicitly marks
        // the type as a donation (not subscription). Subscription payments are
        // now fully handled via checkout.session.completed + invoice events.
        case 'payment_intent.succeeded':
          $pi   = $event->data->object;
          $meta = self::extractMetadata($pi);
          if (!empty($meta) && ($meta['type'] ?? '') === 'donation') {
            $this->handlePaymentIntentSucceeded($pi);
          }
          break;

        // ── KNOWN NOISE — silenced ───────────────────────────────────────
        case 'customer.created':
        case 'customer.updated':
        case 'customer.subscription.created':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed':
        case 'checkout.session.expired':
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
        case 'invoice.updated':
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

  // ── Checkout Session handler ────────────────────────────────────────────────

  /**
   * checkout.session.completed
   *
   * This is the PRIMARY handler for new subscriptions created via the
   * Checkout Sessions API (mode=subscription, ui_mode=elements).
   *
   * The session object contains:
   *   - session->subscription   : Stripe sub ID (sub_xxx)
   *   - session->customer        : Stripe customer ID (cus_xxx)
   *   - session->metadata        : plan_nid, user_uid set when creating the session
   *   - session->payment_intent  : PI ID for the initial invoice (if sync payment)
   *   - session->invoice         : Invoice ID for the initial payment
   *
   * Idempotency: if a subscription node already exists for this Stripe sub ID
   * (e.g. because invoice.payment_succeeded ran first), we skip node creation
   * and only patch any missing fields (invoice_id, payment_intent_id).
   */
  private function handleCheckoutSessionCompleted(object $session): void {
    // Only handle subscription mode sessions.
    if (($session->mode ?? '') !== 'subscription') {
      // Donation / one-time payment sessions are handled via payment_intent.succeeded.
      return;
    }

    $stripeSubId = is_string($session->subscription ?? NULL)
      ? $session->subscription
      : ($session->subscription->id ?? '');

    $customerId = is_string($session->customer ?? NULL)
      ? $session->customer
      : ($session->customer->id ?? '');

    $sessionId = $session->id ?? '';
    $meta      = self::extractMetadata($session);

    $planNid = (int) ($meta['plan_nid'] ?? 0);
    $userUid = (int) ($meta['user_uid'] ?? 0);

    if (empty($stripeSubId) || $planNid === 0 || $userUid === 0) {
      \Drupal::logger('stepuptours_api')->error(
        'checkout.session.completed (@sid): missing stripe_sub_id, plan_nid or user_uid in session metadata.',
        ['@sid' => $sessionId]
      );
      return;
    }

    // ── Idempotency: subscription node may already exist (invoice event won) ──
    $existingNodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (!empty($existingNodes)) {
      // Node already created by invoice.payment_succeeded — nothing to do.
      \Drupal::logger('stepuptours_api')->info(
        'checkout.session.completed (@sid): subscription node already exists for sub @sub — skipping.',
        ['@sid' => $sessionId, '@sub' => $stripeSubId]
      );
      return;
    }

    // ── Retrieve authoritative subscription data from Stripe ─────────────────
    $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
    $subArr    = $stripeSub->toArray();

    // Prefer subscription-level metadata (propagated via subscription_data[metadata]).
    // Fall back to session-level metadata if not set on the subscription yet.
    $subMeta = self::extractMetadata($stripeSub);
    $planNid = (int) ($subMeta['plan_nid'] ?? $planNid);
    $userUid = (int) ($subMeta['user_uid'] ?? $userUid);

    $plan = \Drupal::entityTypeManager()->getStorage('node')->load($planNid);
    if (!$plan) {
      \Drupal::logger('stepuptours_api')->error(
        'checkout.session.completed: plan @nid not found', ['@nid' => $planNid]
      );
      return;
    }

    // ── Period dates ─────────────────────────────────────────────────────────
    $periodStartTs = (int) (
      $subArr['current_period_start']
      ?? ($subArr['items']['data'][0]['current_period_start'] ?? time())
    );
    $periodEndTs = (int) (
      $subArr['current_period_end']
      ?? ($subArr['items']['data'][0]['current_period_end'] ?? 0)
    );

    if ($periodEndTs <= 0) {
      $billingCycle = $plan->get('field_billing_cycle')->value ?? 'month';
      $periodEndTs  = (new \DateTime())->modify('+1 ' . $billingCycle)->getTimestamp();
    }

    // ── Invoice / PaymentIntent details ──────────────────────────────────────
    $invoiceId = is_string($session->invoice ?? NULL)
      ? $session->invoice
      : ($session->invoice->id ?? '');

    // The initial invoice holds the PI for the first payment.
    // If not expanded on the session, fetch the invoice.
    $piId   = '';
    $amount = (float) ($plan->get('field_price')->value ?? 0);

    if (!empty($invoiceId)) {
      try {
        $invoice = \Stripe\Invoice::retrieve($invoiceId);
        $piId    = is_string($invoice->payment_intent ?? NULL)
          ? $invoice->payment_intent
          : ($invoice->payment_intent->id ?? '');
        $amount = ($invoice->amount_paid ?? (int) round($amount * 100)) / 100;
      } catch (\Exception $e) {
        // Non-fatal — proceed without PI/invoice details.
        \Drupal::logger('stepuptours_api')->warning(
          'checkout.session.completed: could not retrieve invoice @inv — @msg',
          ['@inv' => $invoiceId, '@msg' => $e->getMessage()]
        );
      }
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
        } catch (\Exception $e) {
          \Drupal::logger('stepuptours_api')->warning(
            'Could not cancel previous Stripe sub @id: @msg',
            ['@id' => $otherStripeId, '@msg' => $e->getMessage()]
          );
        }
      }
      $otherEnd    = (int) ($other->get('field_end_date')->value ?? 0);
      $otherStatus = ($otherEnd > 0 && $otherEnd <= time()) ? 'expired' : 'cancelled';
      $other->set('field_subscription_status', $otherStatus);
      $other->save();
    }

    // ── Create subscription node ──────────────────────────────────────────────
    $user    = \Drupal\user\Entity\User::load($userUid);
    $name    = $user ? $user->getAccountName() : 'user' . $userUid;
    $startDt = (new \DateTime())->setTimestamp($periodStartTs);

    $subNode = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                         => 'subscription',
      'title'                        => 'Subscription ' . $name . ' ' . $startDt->format('Y-m-d'),
      'status'                       => 1,
      'uid'                          => $userUid,
      'field_user'                   => ['target_id' => $userUid],
      'field_plan'                   => ['target_id' => $planNid],
      'field_subscription_status'    => 'active',
      'field_start_date'             => $periodStartTs,
      'field_end_date'               => $periodEndTs,
      'field_auto_renewal'           => TRUE,
      'field_stripe_subscription_id' => $stripeSubId,
      'field_stripe_customer_id'     => $customerId,
    ]);
    $subNode->save();

    // ── Create subscription_payment node (only if not already created) ────────
    $paymentCreated = FALSE;

    if (!empty($piId)) {
      $existingByPi = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                        => 'subscription_payment',
          'field_stripe_payment_intent' => $piId,
        ]);
      if (!empty($existingByPi)) {
        $existing = reset($existingByPi);
        $existing->set('field_subscription', ['target_id' => $subNode->id()]);
        $existing->save();
        $paymentCreated = TRUE;
      }
    }

    if (!$paymentCreated && !empty($invoiceId)) {
      $existingByInvoice = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties([
          'type'                    => 'subscription_payment',
          'field_stripe_invoice_id' => $invoiceId,
        ]);
      if (!empty($existingByInvoice)) {
        $existing = reset($existingByInvoice);
        $existing->set('field_subscription', ['target_id' => $subNode->id()]);
        $existing->save();
        $paymentCreated = TRUE;
      }
    }

    if (!$paymentCreated && $amount > 0) {
      $payment = \Drupal::entityTypeManager()->getStorage('node')->create([
        'type'                        => 'subscription_payment',
        'title'                       => 'Payment ' . ($invoiceId ?: $sessionId),
        'status'                      => 1,
        'uid'                         => $userUid,
        'field_subscription'          => ['target_id' => $subNode->id()],
        'field_user'                  => ['target_id' => $userUid],
        'field_plan'                  => ['target_id' => $planNid],
        'field_amount'                => (string) $amount,
        'field_stripe_invoice_id'     => $invoiceId,
        'field_stripe_payment_intent' => $piId,
        'field_payment_status'        => 'succeed',
        'field_period_start'          => $periodStartTs,
        'field_period_end'            => $periodEndTs,
      ]);
      $payment->save();
    }

    \Drupal::logger('stepuptours_api')->info(
      'Subscription created via checkout.session.completed: node @nid, sub @sub, user @uid, end @end',
      [
        '@nid' => $subNode->id(),
        '@sub' => $stripeSubId,
        '@uid' => $userUid,
        '@end' => date('Y-m-d H:i:s', $periodEndTs),
      ]
    );
  }

  // ── Invoice handlers ────────────────────────────────────────────────────────

  /**
   * invoice.payment_succeeded
   *
   * Handles renewal payments (and the initial payment as a safe fallback).
   * For new subscriptions created via Checkout Sessions, checkout.session.completed
   * is the primary handler and this runs second — idempotency ensures no duplicates.
   *
   * Metadata is read from the Stripe Subscription object (propagated via
   * subscription_data[metadata] when creating the CheckoutSession).
   */
  private function handleInvoicePaymentSucceeded(object $invoice): void {
    $stripeSubId = '';
    if (!empty($invoice->subscription)) {
      $stripeSubId = is_string($invoice->subscription)
        ? $invoice->subscription
        : ($invoice->subscription->id ?? '');
    }

    $invoiceId  = $invoice->id ?? '';
    $amountPaid = (int) ($invoice->amount_paid ?? 0);

    if (empty($stripeSubId) || empty($invoiceId)) {
      \Drupal::logger('stepuptours_api')->warning(
        'invoice.payment_succeeded: missing subscription or invoice id (invoice: @inv, sub: @sub)',
        ['@inv' => $invoiceId ?: 'n/a', '@sub' => $stripeSubId ?: 'n/a']
      );
      return;
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
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

      $piIdForCheck = is_string($invoice->payment_intent ?? NULL)
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
          $existing = reset($existingByPi);
          $existing->set('field_stripe_invoice_id', $invoiceId);
          $existing->save();
          return;
        }
      }
    }

    // ── Retrieve Stripe Subscription ─────────────────────────────────────────
    $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
    $meta      = self::extractMetadata($stripeSub);
    $subArr    = $stripeSub->toArray();

    $planNid    = (int) ($meta['plan_nid'] ?? 0);
    $userUid    = (int) ($meta['user_uid'] ?? 0);
    $customerId = $invoice->customer ?? '';

    if ($planNid === 0 || $userUid === 0) {
      \Drupal::logger('stepuptours_api')->warning(
        'invoice.payment_succeeded: missing plan_nid or user_uid in Stripe subscription metadata (sub: @sub)',
        ['@sub' => $stripeSubId]
      );
      return;
    }

    $plan = \Drupal::entityTypeManager()->getStorage('node')->load($planNid);
    if (!$plan) {
      \Drupal::logger('stepuptours_api')->error(
        'invoice.payment_succeeded: plan @nid not found', ['@nid' => $planNid]
      );
      return;
    }

    $billingCycle = $plan->get('field_billing_cycle')->value;
    $periodStart  = (new \DateTime())->setTimestamp((int) ($invoice->period_start ?? time()));

    // Authoritative end date from the Stripe Subscription.
    $newEndTs = $subArr['current_period_end']
      ?? ($subArr['items']['data'][0]['current_period_end'] ?? NULL);

    if (empty($newEndTs)) {
      $newEndTs = (new \DateTime())->modify('+1 ' . $billingCycle)->getTimestamp();
    }

    // ── Find or create subscription node ─────────────────────────────────────
    $subNodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                         => 'subscription',
        'field_stripe_subscription_id' => $stripeSubId,
      ]);

    if (!empty($subNodes)) {
      $subNode           = reset($subNodes);
      $cancelAtPeriodEnd = !empty($subArr['cancel_at_period_end']);

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
      // Fallback: checkout.session.completed hasn't run yet (race) or was missed.
      // Only create the node here for paid invoices — $0 invoices are not first payments.
      if ($amountPaid <= 0) {
        \Drupal::logger('stepuptours_api')->info(
          'invoice.payment_succeeded: skipping $0 invoice @inv for sub @sub — no subscription node yet.',
          ['@inv' => $invoiceId, '@sub' => $stripeSubId]
        );
        return;
      }

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

    // Skip payment node for $0 invoices.
    if ($amountPaid <= 0) {
      \Drupal::logger('stepuptours_api')->info(
        'Synced end_date from $0 invoice @inv for sub @sub (new end: @ts).',
        ['@inv' => $invoiceId, '@sub' => $stripeSubId, '@ts' => date('Y-m-d H:i:s', (int) $newEndTs)]
      );
      return;
    }

    // ── Create subscription_payment node ──────────────────────────────────────
    $amount = $amountPaid / 100;
    $piId   = is_string($invoice->payment_intent ?? NULL)
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
      'Renewal payment recorded: invoice @inv for user @uid, amount @amount, end @end',
      ['@inv' => $invoiceId, '@uid' => $userUid, '@amount' => $amount, '@end' => date('Y-m-d H:i:s', (int) $newEndTs)]
    );
  }

  /**
   * invoice.payment_failed
   * Records a failed payment and marks the subscription as past_due.
   */
  private function handleInvoicePaymentFailed(object $invoice): void {
    $stripeSubId = $invoice->subscription ?? '';
    $invoiceId   = $invoice->id ?? '';

    if (empty($invoiceId)) {
      return;
    }

    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'subscription_payment',
        'field_stripe_invoice_id' => $invoiceId,
      ]);

    if (!empty($existing)) {
      return;
    }

    $userUid = 0;
    $planNid = 0;
    if (!empty($stripeSubId)) {
      try {
        $stripeSub = \Stripe\Subscription::retrieve($stripeSubId);
        $meta      = self::extractMetadata($stripeSub);
        $userUid   = (int) ($meta['user_uid'] ?? 0);
        $planNid   = (int) ($meta['plan_nid'] ?? 0);
      } catch (\Exception $e) {
        // Continue even without metadata.
      }
    }

    $periodStart = (new \DateTime())->setTimestamp((int) ($invoice->period_start ?? time()));
    $periodEnd   = (new \DateTime())->setTimestamp((int) ($invoice->period_end ?? time()));
    $amount      = ($invoice->amount_due ?? 0) / 100;
    $piId        = is_string($invoice->payment_intent ?? NULL)
      ? $invoice->payment_intent
      : ($invoice->payment_intent->id ?? '');

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
      $fields['uid']        = $userUid;
      $fields['field_user'] = ['target_id' => $userUid];
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
   * Marks the Drupal subscription node as expired.
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

    $node              = reset($nodes);
    $cancelAtPeriodEnd = (bool) ($stripeSub->cancel_at_period_end ?? FALSE);
    $autoRenewal       = !$cancelAtPeriodEnd;

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
   */
  private static function extractMetadata(object $stripeObject): array {
    $meta = $stripeObject->metadata ?? [];

    if (is_object($meta) && method_exists($meta, 'toArray')) {
      return $meta->toArray();
    }

    return (array) $meta;
  }

  /**
   * Handle successful PaymentIntent for one-time donations.
   * Only called when metadata type === 'donation'.
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
   * invoice_payment.paid — newer Stripe Invoice Payment API.
   * Fetch the full invoice and delegate to handleInvoicePaymentSucceeded().
   */
  private function handleInvoicePaymentPaidEvent(object $invoicePayment): void {
    $invoiceId = is_string($invoicePayment->invoice ?? NULL)
      ? $invoicePayment->invoice
      : ($invoicePayment->invoice->id ?? '');

    if (empty($invoiceId)) {
      \Drupal::logger('stepuptours_api')->warning(
        'invoice_payment.paid: missing invoice ID in event object.'
      );
      return;
    }

    try {
      $invoice = \Stripe\Invoice::retrieve($invoiceId);
      $this->handleInvoicePaymentSucceeded($invoice);
    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error(
        'invoice_payment.paid: could not process invoice @id — @msg',
        ['@id' => $invoiceId, '@msg' => $e->getMessage()]
      );
    }
  }

}
