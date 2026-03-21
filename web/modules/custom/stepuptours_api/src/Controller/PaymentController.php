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

    $config = \Drupal::config('stepuptours.payment');
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
    $paymentConfig = \Drupal::config('stepuptours.payment');
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

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
