<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Stripe payment endpoints for donations.
 */
class PaymentController extends ControllerBase {

  /**
   * GET /api/payment/config — public.
   * Returns Stripe publishable key.
   */
  public function getConfig(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $config = \Drupal::config('stepuptours_api.payment');
    $publishableKey = $config->get('stripe_publishable_key') ?? '';

    return $this->corsResponse(new JsonResponse([
      'publishableKey' => $publishableKey,
    ], 200));
  }

  /**
   * POST /api/payment/donation-intent — authenticated.
   * Creates a Stripe PaymentIntent for a donation.
   */
  public function donationIntent(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || !isset($body['tourId']) || !isset($body['amount'])) {
      return $this->corsResponse(new JsonResponse([
        'error' => 'Missing tourId or amount',
      ], 400));
    }

    $tourId = $body['tourId'];
    $amount = (float) $body['amount'];
    $currency = $body['currency'] ?? 'eur';

    if ($amount <= 0) {
      return $this->corsResponse(new JsonResponse([
        'error' => 'Amount must be positive',
      ], 400));
    }

    // Load tour to get the author.
    $nodes = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $tourId, 'type' => 'tour']);

    if (empty($nodes)) {
      return $this->corsResponse(new JsonResponse([
        'error' => 'Tour not found',
      ], 404));
    }

    $tour = reset($nodes);
    $guideUid = (int) $tour->getOwnerId();
    $guideUser = \Drupal\user\Entity\User::load($guideUid);

    if (!$guideUser) {
      return $this->corsResponse(new JsonResponse([
        'error' => 'Tour author not found',
      ], 404));
    }

    // Determine revenue split.
    $paymentConfig = \Drupal::config('stepuptours_api.payment');
    $guideRoles = $guideUser->getRoles();

    if (in_array('administrator', $guideRoles, TRUE)) {
      // Admin-owned tour: 100% to platform.
      $platformPercentage = 100;
    } else {
      $platformPercentage = (int) ($paymentConfig->get('platform_revenue_percentage') ?? 20);
    }

    $guideRevenue = round($amount * (100 - $platformPercentage) / 100, 2);
    $platformRevenue = round($amount - $guideRevenue, 2);

    // Create Stripe PaymentIntent.
    $secretKey = $paymentConfig->get('stripe_secret_key');
    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse([
        'error' => 'Stripe is not configured. Please set a valid secret key.',
      ], 503));
    }

    try {
      \Stripe\Stripe::setApiKey($secretKey);

      $donorUid = (string) \Drupal::currentUser()->id();

      $paymentIntent = \Stripe\PaymentIntent::create([
        'amount' => (int) round($amount * 100), // cents
        'currency' => strtolower($currency),
        'payment_method_types' => ['card'],
        'metadata' => [
          'tour_id' => $tourId,
          'tour_nid' => (string) $tour->id(),
          'donor_uid' => $donorUid,
          'guide_uid' => (string) $guideUid,
          'guide_revenue' => (string) $guideRevenue,
          'platform_revenue' => (string) $platformRevenue,
          'currency_code' => strtoupper($currency),
        ],
      ]);

      return $this->corsResponse(new JsonResponse([
        'clientSecret' => $paymentIntent->client_secret,
        'paymentIntentId' => $paymentIntent->id,
        'guideRevenue' => $guideRevenue,
        'platformRevenue' => $platformRevenue,
      ], 200));

    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Stripe PaymentIntent error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse([
        'error' => 'Payment processing error',
      ], 500));
    }
  }

  /**
   * POST /api/payment/donation-activate — authenticated.
   *
   * Body: { paymentIntentId: "pi_..." }
   * Verifies payment with Stripe and creates the donation node.
   * Idempotent: if the node already exists (webhook beat us to it), returns it.
   */
  public function donationActivate(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (!$body || empty($body['paymentIntentId'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing paymentIntentId'], 400));
    }

    $paymentIntentId = $body['paymentIntentId'];

    $config    = \Drupal::config('stepuptours_api.payment');
    $secretKey = $config->get('stripe_secret_key') ?? '';

    if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
      return $this->corsResponse(new JsonResponse(['error' => 'Stripe is not configured'], 503));
    }

    // Verify PaymentIntent with Stripe.
    try {
      \Stripe\Stripe::setApiKey($secretKey);
      $paymentIntent = \Stripe\PaymentIntent::retrieve($paymentIntentId);

      if ($paymentIntent->status !== 'succeeded') {
        return $this->corsResponse(new JsonResponse([
          'error' => 'Payment not confirmed (status: ' . $paymentIntent->status . ')',
        ], 402));
      }
    } catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('donation-activate Stripe error: @msg', [
        '@msg' => $e->getMessage(),
      ]);
      return $this->corsResponse(new JsonResponse(['error' => 'Failed to verify payment'], 500));
    }

    // Idempotency: check if donation node already created (e.g. by webhook).
    $existing = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties([
        'type'                    => 'donation',
        'field_payment_reference' => $paymentIntentId,
      ]);

    if (!empty($existing)) {
      $donation = reset($existing);
      \Drupal::logger('stepuptours_api')->info('donation-activate: duplicate @id, returning existing node', [
        '@id' => $paymentIntentId,
      ]);
      return $this->corsResponse(new JsonResponse($this->formatDonation($donation), 200));
    }

    // Extract metadata from the PaymentIntent.
    $meta = is_object($paymentIntent->metadata) && method_exists($paymentIntent->metadata, 'toArray')
      ? $paymentIntent->metadata->toArray()
      : (array) ($paymentIntent->metadata ?? []);

    $tourNid         = $meta['tour_nid'] ?? '';
    $donorUid        = $meta['donor_uid'] ?? '';
    $guideRevenue    = $meta['guide_revenue'] ?? '0';
    $platformRevenue = $meta['platform_revenue'] ?? '0';
    $currencyCode    = $meta['currency_code'] ?? 'EUR';

    if (empty($tourNid) || empty($donorUid)) {
      return $this->corsResponse(new JsonResponse(['error' => 'PaymentIntent metadata incomplete'], 422));
    }

    $amount = ($paymentIntent->amount ?? 0) / 100; // cents → euros

    // Create the donation node.
    $node = \Drupal::entityTypeManager()->getStorage('node')->create([
      'type'                    => 'donation',
      'title'                   => 'Donation ' . $paymentIntentId,
      'status'                  => 1,
      'uid'                     => (int) $donorUid,
      'field_tour'              => ['target_id' => (int) $tourNid],
      'field_user'              => ['target_id' => (int) $donorUid],
      'field_amount'            => (string) $amount,
      'field_guide_revenue'     => (string) $guideRevenue,
      'field_platform_revenue'  => (string) $platformRevenue,
      'field_payment_reference' => $paymentIntentId,
      'field_currency_code'     => $currencyCode,
    ]);

    $node->save();

    \Drupal::logger('stepuptours_api')->info(
      'Donation activated: @nid for tour @tour, amount @amount',
      ['@nid' => $node->id(), '@tour' => $tourNid, '@amount' => $amount]
    );

    return $this->corsResponse(new JsonResponse($this->formatDonation($node), 201));
  }

  /**
   * Formats a donation node for the API response.
   */
  private function formatDonation($node): array {
    return [
      'id'               => $node->uuid(),
      'amount'           => (float) ($node->get('field_amount')->value ?? 0),
      'guideRevenue'     => (float) ($node->get('field_guide_revenue')->value ?? 0),
      'platformRevenue'  => (float) ($node->get('field_platform_revenue')->value ?? 0),
      'paymentReference' => $node->get('field_payment_reference')->value ?? '',
      'currency'         => $node->get('field_currency_code')->value ?? 'EUR',
      'createdAt'        => $node->getCreatedTime(),
    ];
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
