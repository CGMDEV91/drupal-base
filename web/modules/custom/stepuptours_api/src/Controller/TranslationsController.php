<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Admin endpoints for frontend i18n translation management.
 */
class TranslationsController extends ControllerBase {

  /**
   * Path to the i18n locales directory.
   */
  private function localesDir(): string {
    return DRUPAL_ROOT . '/../frontend/stepuptours/i18n/locales';
  }

  /**
   * GET /api/admin/languages — public.
   */
  public function languages(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    $excluded = ['und', 'zxx'];
    $languages = \Drupal::languageManager()->getLanguages();
    $data = [];
    foreach ($languages as $langcode => $language) {
      if (in_array($langcode, $excluded, TRUE)) {
        continue;
      }
      $data[] = [
        'id'    => $langcode,
        'label' => $language->getName(),
      ];
    }

    return $this->corsResponse(new JsonResponse($data, 200));
  }

  /**
   * GET /api/admin/translations/{langcode} — admin only.
   */
  public function getTranslations(Request $request, string $langcode): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    if (!$this->isAdministrator()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $localesDir = $this->localesDir();
    $sourceFile = $localesDir . '/en.json';

    if (!file_exists($sourceFile)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Source file en.json not found'], 404));
    }

    $sourceData = $this->readJsonFile($sourceFile);
    if ($sourceData === NULL) {
      return $this->corsResponse(new JsonResponse(['error' => 'Could not parse en.json'], 500));
    }

    $targetData = [];
    $targetFile = $localesDir . '/' . $langcode . '.json';
    if (file_exists($targetFile)) {
      $parsed = $this->readJsonFile($targetFile);
      if ($parsed !== NULL) {
        $targetData = $parsed;
      }
    }

    // The JSON files use flat dot-notation keys directly (not nested).
    $rows = [];
    foreach ($sourceData as $key => $sourceValue) {
      $rows[] = [
        'key'    => (string) $key,
        'source' => (string) $sourceValue,
        'target' => isset($targetData[$key]) ? (string) $targetData[$key] : '',
      ];
    }

    usort($rows, static fn($a, $b) => strcmp($a['key'], $b['key']));

    return $this->corsResponse(new JsonResponse($rows, 200));
  }

  /**
   * PUT /api/admin/translations/{langcode} — admin only.
   */
  public function saveTranslations(Request $request, string $langcode): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    if (!$this->isAdministrator()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    if ($langcode === 'en') {
      return $this->corsResponse(new JsonResponse(['error' => 'Cannot overwrite the source language (en)'], 400));
    }

    $body = json_decode($request->getContent(), TRUE);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($body)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Invalid JSON body'], 400));
    }

    if (!isset($body['translations']) || !is_array($body['translations'])) {
      return $this->corsResponse(new JsonResponse(['error' => 'Missing translations array'], 400));
    }

    $localesDir = $this->localesDir();
    if (!is_dir($localesDir) && !mkdir($localesDir, 0755, TRUE)) {
      return $this->corsResponse(new JsonResponse(['error' => 'Could not create locales directory'], 500));
    }

    $targetFile = $localesDir . '/' . $langcode . '.json';

    // Load existing data.
    $existing = [];
    if (file_exists($targetFile)) {
      $parsed = $this->readJsonFile($targetFile);
      if ($parsed !== NULL) {
        $existing = $parsed;
      }
    }

    // Merge incoming translations.
    foreach ($body['translations'] as $entry) {
      if (!isset($entry['key'])) {
        continue;
      }
      $existing[(string) $entry['key']] = $entry['value'] ?? '';
    }

    // Sort by key for consistent output.
    ksort($existing);

    $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === FALSE || file_put_contents($targetFile, $json . "\n") === FALSE) {
      return $this->corsResponse(new JsonResponse(['error' => 'Could not write file'], 500));
    }

    return $this->corsResponse(new JsonResponse(['saved' => TRUE, 'langcode' => $langcode], 200));
  }

  private function isAdministrator(): bool {
    return in_array('administrator', \Drupal::currentUser()->getRoles(), TRUE);
  }

  private function readJsonFile(string $path): ?array {
    $raw = file_get_contents($path);
    if ($raw === FALSE) {
      return NULL;
    }
    $decoded = json_decode($raw, TRUE);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
      return NULL;
    }
    return $decoded;
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
