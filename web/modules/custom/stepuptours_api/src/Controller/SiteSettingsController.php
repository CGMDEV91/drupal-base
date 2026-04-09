<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Endpoint público de configuración del sitio.
 *
 * GET /api/site-settings
 * Returns site name, email, slogan and contact info.
 */
class SiteSettingsController extends ControllerBase {

  /**
   * Default social links structure.
   */
  private const SOCIAL_LINKS_DEFAULTS = [
    'facebook'  => ['url' => '', 'visible' => TRUE],
    'twitter'   => ['url' => '', 'visible' => TRUE],
    'instagram' => ['url' => '', 'visible' => TRUE],
  ];

  /**
   * GET /api/site-settings — public.
   */
  public function get(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    try {
      return $this->corsResponse(new JsonResponse($this->buildSettingsData(), 200));
    }
    catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('SiteSettings error: @msg', ['@msg' => $e->getMessage()]);
      return $this->corsResponse(new JsonResponse([
        'siteName'  => 'StepUp Tours',
        'siteEmail' => 'info@stepuptours.com',
        'slogan'    => 'Explore the world step by step',
        'address'   => 'Madrid, España',
        'phone'     => '',
        'socialLinks' => self::SOCIAL_LINKS_DEFAULTS,
      ], 200));
    }
  }

  /**
   * PUT /api/site-settings — admin only.
   */
  public function update(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $account = \Drupal::currentUser();
    if (!in_array('administrator', $account->getRoles(), TRUE)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($body)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Invalid JSON body'], 400));
    }

    if (isset($body['socialLinks']) && is_array($body['socialLinks'])) {
      $config = \Drupal::service('config.factory')
        ->getEditable('stepuptours.social_links');

      foreach (['facebook', 'twitter', 'instagram'] as $network) {
        if (isset($body['socialLinks'][$network]) && is_array($body['socialLinks'][$network])) {
          $incoming = $body['socialLinks'][$network];
          if (array_key_exists('url', $incoming)) {
            $config->set($network . '.url', (string) $incoming['url']);
          }
          if (array_key_exists('visible', $incoming)) {
            $config->set($network . '.visible', (bool) $incoming['visible']);
          }
        }
      }
      $config->save();
    }

    // Handle payment settings.
    if (isset($body['paymentSettings']) && is_array($body['paymentSettings'])) {
      $paymentConfig = \Drupal::service('config.factory')
        ->getEditable('stepuptours_api.payment');

      if (isset($body['paymentSettings']['platformRevenuePercentage'])) {
        $pct = max(0, min(100, (int) $body['paymentSettings']['platformRevenuePercentage']));
        $paymentConfig->set('platform_revenue_percentage', $pct);
      }
      $paymentConfig->save();
    }

    // Handle Stripe keys — never return secret values, only store them.
    if (isset($body['stripeSettings']) && is_array($body['stripeSettings'])) {
      $stripeConfig = \Drupal::service('config.factory')
        ->getEditable('stepuptours_api.payment');

      $pk = $body['stripeSettings']['publishableKey'] ?? '';
      if (!empty($pk) && str_starts_with($pk, 'pk_')) {
        $stripeConfig->set('stripe_publishable_key', trim($pk));
      }

      $sk = $body['stripeSettings']['secretKey'] ?? '';
      if (!empty($sk) && str_starts_with($sk, 'sk_')) {
        $stripeConfig->set('stripe_secret_key', trim($sk));
      }

      $whsec = $body['stripeSettings']['webhookSecret'] ?? '';
      if (!empty($whsec) && str_starts_with($whsec, 'whsec_')) {
        $stripeConfig->set('stripe_webhook_secret', trim($whsec));
      }

      $stripeConfig->save();
    }

    return $this->corsResponse(new JsonResponse($this->buildSettingsData(), 200));
  }

  /**
   * Builds full settings data (used by GET and PUT).
   */
  private function buildSettingsData(): array {
    $siteConfig    = \Drupal::config('system.site');
    $contactConfig = \Drupal::config('stepuptours.contact');
    $socialConfig  = \Drupal::config('stepuptours.social_links');

    $socialLinks = [];
    foreach (self::SOCIAL_LINKS_DEFAULTS as $network => $defaults) {
      $socialLinks[$network] = [
        'url'     => $socialConfig->get($network . '.url') ?? $defaults['url'],
        'visible' => $socialConfig->get($network . '.visible') ?? $defaults['visible'],
      ];
    }

    $paymentConfig = \Drupal::config('stepuptours_api.payment');

    $pk     = $paymentConfig->get('stripe_publishable_key') ?? '';
    $sk     = $paymentConfig->get('stripe_secret_key') ?? '';
    $whsec  = $paymentConfig->get('stripe_webhook_secret') ?? '';

    $pkConfigured    = !empty($pk) && $pk !== 'pk_test_PLACEHOLDER';
    $skConfigured    = !empty($sk) && $sk !== 'sk_test_PLACEHOLDER';
    $whsecConfigured = !empty($whsec) && $whsec !== 'whsec_PLACEHOLDER';

    return [
      'siteName'    => $siteConfig->get('name') ?? 'StepUp Tours',
      'siteEmail'   => $siteConfig->get('mail') ?? '',
      'slogan'      => $siteConfig->get('slogan') ?? 'Explore the world step by step',
      'address'     => $contactConfig->get('address') ?? 'Calle Gran Vía 1, Madrid, España',
      'phone'       => $contactConfig->get('phone') ?? '+34 600 000 000',
      'socialLinks' => $socialLinks,
      'paymentSettings' => [
        'platformRevenuePercentage' => (int) ($paymentConfig->get('platform_revenue_percentage') ?? 20),
        'stripeConfigured' => $pkConfigured && $skConfigured,
      ],
      'stripeSettings' => [
        'publishableKey'      => $pkConfigured ? $pk : '',
        'secretKeyConfigured' => $skConfigured,
        'webhookConfigured'   => $whsecConfigured,
      ],
    ];
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
