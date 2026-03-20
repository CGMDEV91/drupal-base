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

  public function get(Request $request): JsonResponse {

    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    try {
      $config = \Drupal::config('system.site');

      $siteName  = $config->get('name') ?? 'StepUp Tours';
      $siteEmail = $config->get('mail') ?? '';
      $slogan    = $config->get('slogan') ?? 'Explore the world step by step';

      // Extended contact info — stored in a custom config or with defaults.
      $contactConfig = \Drupal::config('stepuptours.contact');
      $address = $contactConfig->get('address') ?? 'Calle Gran Vía 1, Madrid, España';
      $phone   = $contactConfig->get('phone')   ?? '+34 600 000 000';

      $data = [
        'siteName'  => $siteName,
        'siteEmail' => $siteEmail,
        'slogan'    => $slogan,
        'address'   => $address,
        'phone'     => $phone,
      ];

      return $this->corsResponse(new JsonResponse($data, 200));

    }
    catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('SiteSettings error: @msg', ['@msg' => $e->getMessage()]);
      return $this->corsResponse(new JsonResponse([
        'siteName'  => 'StepUp Tours',
        'siteEmail' => 'info@stepuptours.com',
        'slogan'    => 'Explore the world step by step',
        'address'   => 'Madrid, España',
        'phone'     => '',
      ], 200));
    }
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
