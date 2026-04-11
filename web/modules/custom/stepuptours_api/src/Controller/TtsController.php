<?php
declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TTS controller with server-side persistent cache.
 *
 * Generation strategy (in order):
 *   1. edge-tts CLI (available in local/DDEV and any server where pip is allowed)
 *   2. Railway microservice fallback (STEPUPTOURS_TTS_RAILWAY_URL env var)
 *
 * Either way the MP3 is stored in public://tts/{hash}.mp3 and a JSON { url }
 * response is returned.  Subsequent requests for the same text+langcode are
 * served directly from the cached file — no generation needed.
 */
class TtsController extends ControllerBase {

  private const VOICES = [
    'es' => 'es-ES-AlvaroNeural',
    'en' => 'en-US-GuyNeural',
    'fr' => 'fr-FR-HenriNeural',
    'de' => 'de-DE-ConradNeural',
    'it' => 'it-IT-DiegoNeural',
    'pt' => 'pt-BR-AntonioNeural',
    'nl' => 'nl-NL-MaartenNeural',
    'pl' => 'pl-PL-MarekNeural',
    'ru' => 'ru-RU-DmitryNeural',
    'ja' => 'ja-JP-KeitaNeural',
    'zh' => 'zh-CN-YunxiNeural',
    'ar' => 'ar-SA-HamedNeural',
    'ca' => 'ca-ES-EnricNeural',
    'eu' => 'eu-ES-AnderNeural',
    'ko' => 'ko-KR-InJoonNeural',
    'el' => 'el-GR-NestorasNeural',
  ];

  public function __construct(private readonly FileSystemInterface $fileSystem) {}

  public static function create(ContainerInterface $container): static {
    return new static($container->get('file_system'));
  }

  public function synthesize(Request $request): Response {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new Response('', 204));
    }

    $data      = json_decode($request->getContent(), TRUE);
    $rawText   = trim((string) ($data['text']      ?? ''));
    $langcode  = strtolower(trim((string) ($data['langcode']  ?? 'en')));
    $tourTitle = trim((string) ($data['tourTitle'] ?? ''));
    $stepTitle = trim((string) ($data['stepTitle'] ?? ''));

    if ($rawText === '') {
      return $this->corsResponse(new Response('Missing text', 400));
    }

    // Normalise whitespace/newlines before synthesis and cache-key generation.
    // Double newlines become ". " so edge-tts treats them as sentence endings
    // rather than paragraph gaps, eliminating unnatural pauses mid-narration.
    $text = $this->preprocessText($rawText);

    $hash      = substr(hash('sha256', $langcode . ':' . $text), 0, 16);
    $lang      = strtoupper(substr($langcode, 0, 2));
    $prefix    = $this->buildPrefix($tourTitle, $stepTitle);
    $filename  = $prefix ? "{$prefix}-{$lang}-{$hash}.mp3" : "{$lang}-{$hash}.mp3";
    $cacheDir  = 'public://tts';
    $cachePath = "{$cacheDir}/{$filename}";

    // ── 1. Already cached → return URL immediately ────────────────────────────
    $realPath = $this->fileSystem->realpath($cachePath);
    if ($realPath && file_exists($realPath)) {
      return $this->urlResponse($filename);
    }

    // ── 2. Prepare cache directory ────────────────────────────────────────────
    $this->fileSystem->prepareDirectory(
      $cacheDir,
      FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS,
    );
    $cacheRealDir = $this->fileSystem->realpath($cacheDir);

    // ── 3a. Try edge-tts CLI ──────────────────────────────────────────────────
    $bin = $this->resolveEdgeTtsBin();
    if ($bin !== NULL) {
      $voice  = $this->resolveVoice($langcode);
      $tmpOut = tempnam(sys_get_temp_dir(), 'tts_') . '.mp3';

      $cmd = sprintf(
        '%s --voice %s --text %s --write-media %s 2>&1',
        escapeshellarg($bin),
        escapeshellarg($voice),
        escapeshellarg($text),
        escapeshellarg($tmpOut),
      );

      exec($cmd, $cmdOutput, $exitCode);

      if ($exitCode === 0 && file_exists($tmpOut) && filesize($tmpOut) > 0) {
        rename($tmpOut, $cacheRealDir . "/{$filename}");
        return $this->urlResponse($filename);
      }

      @unlink($tmpOut);
      // Fall through to Railway fallback.
    }

    // ── 3b. Railway microservice fallback ─────────────────────────────────────
    $railwayUrl = getenv('STEPUPTOURS_TTS_RAILWAY_URL') ?: '';
    if ($railwayUrl === '') {
      return $this->corsResponse(new Response(
        'TTS unavailable: edge-tts not found and STEPUPTOURS_TTS_RAILWAY_URL not configured.',
        501,
      ));
    }

    $endpoint = rtrim($railwayUrl, '/') . '/tts';
    $payload  = json_encode(['text' => $text, 'langcode' => $langcode]);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
      CURLOPT_POST           => TRUE,
      CURLOPT_POSTFIELDS     => $payload,
      CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
      CURLOPT_RETURNTRANSFER => TRUE,
      CURLOPT_TIMEOUT        => 90,
    ]);

    $binary   = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($binary === FALSE || $httpCode !== 200 || strlen($binary) === 0) {
      $detail = $curlErr ?: "HTTP {$httpCode}";
      return $this->corsResponse(new Response("Railway TTS error: {$detail}", 502));
    }

    file_put_contents($cacheRealDir . "/{$filename}", $binary);

    return $this->urlResponse($filename);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private function urlResponse(string $filename): Response {
    $path    = \Drupal::service('file_url_generator')->generateAbsoluteString("public://tts/{$filename}");
    $payload = json_encode(['url' => $path]);

    return $this->corsResponse(new Response($payload, 200, [
      'Content-Type'  => 'application/json',
      'Cache-Control' => 'public, max-age=31536000, immutable',
    ]));
  }

  private function slugify(string $str): string {
    $str = strip_tags($str);
    $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str) ?: $str;
    $str = strtolower($str);
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    $str = trim($str, '-');
    return substr($str, 0, 30);
  }

  private function buildPrefix(string $tourTitle, string $stepTitle): string {
    $parts = array_filter([$this->slugify($tourTitle), $this->slugify($stepTitle)]);
    return implode('-', $parts);
  }

  private function resolveEdgeTtsBin(): ?string {
    exec('which edge-tts 2>/dev/null', $out, $code);
    if ($code === 0 && !empty($out[0])) {
      return trim($out[0]);
    }
    foreach ([
      '/home/carlos/.local/bin/edge-tts',
      '/root/.local/bin/edge-tts',
      '/usr/local/bin/edge-tts',
      '/usr/bin/edge-tts',
    ] as $path) {
      if (is_executable($path)) return $path;
    }
    return NULL;
  }

  private function resolveVoice(string $langcode): string {
    return self::VOICES[substr($langcode, 0, 2)] ?? self::VOICES['en'];
  }

  private function preprocessText(string $text): string {
    // 2+ consecutive newlines/CRs → ". " so edge-tts treats them as sentence
    // endings rather than paragraph gaps (which introduce perceptible pauses).
    $text = preg_replace('/[\r\n]{2,}/', '. ', $text);
    // Remaining single \n/\r → space (e.g. stripped <br> tags).
    $text = preg_replace('/[\r\n]/', ' ', $text);
    // Collapse runs of 2+ spaces into one.
    $text = preg_replace('/ {2,}/', ' ', $text);
    return trim($text);
  }

  private function corsResponse(Response $response): Response {
    $response->headers->set('Access-Control-Allow-Origin',  '*');
    $response->headers->set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
