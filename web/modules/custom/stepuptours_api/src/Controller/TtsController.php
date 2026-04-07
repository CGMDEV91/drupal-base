<?php
declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class TtsController extends ControllerBase {

  private const EDGE_TTS_BIN = '/home/carlos/.local/bin/edge-tts';

  // Default voices per language (neural, natural-sounding)
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
  ];

  public function synthesize(Request $request): Response {
    // ── CORS preflight ─────────────────────────────────────────────
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new Response('', 204));
    }

    $data = json_decode($request->getContent(), TRUE);

    $text = trim((string) ($data['text'] ?? ''));
    $langcode = strtolower(trim((string) ($data['langcode'] ?? 'es')));

    if ($text === '') {
      return $this->corsResponse(new Response('Missing text', 400));
    }

    $voice = $this->resolveVoice($langcode);
    $output = tempnam(sys_get_temp_dir(), 'tts_') . '.mp3';

    $cmd = sprintf(
      '%s --voice %s --text %s --write-media %s 2>&1',
      escapeshellarg(self::EDGE_TTS_BIN),
      escapeshellarg($voice),
      escapeshellarg($text),
      escapeshellarg($output),
    );

    exec($cmd, $cmdOutput, $exitCode);

    if ($exitCode !== 0 || !file_exists($output) || filesize($output) === 0) {
      @unlink($output);
      $error = implode("\n", $cmdOutput);
      return $this->corsResponse(new Response("TTS error: $error", 502));
    }

    $audio = file_get_contents($output);
    @unlink($output);

    return $this->corsResponse(new Response($audio, 200, [
      'Content-Type'   => 'audio/mpeg',
      'Content-Length' => (string) strlen($audio),
      'Cache-Control'  => 'no-store',
    ]));
  }

  // ───────────────────────────────────────────────────────────────
  // Resolve Edge TTS voice from language code
  // ───────────────────────────────────────────────────────────────

  private function resolveVoice(string $langcode): string {
    // Try exact match first (e.g. "es"), then prefix (e.g. "es-MX" → "es")
    $short = substr($langcode, 0, 2);
    return self::VOICES[$short] ?? self::VOICES['en'];
  }

  // ───────────────────────────────────────────────────────────────
  // CORS helper
  // ───────────────────────────────────────────────────────────────

  private function corsResponse(Response $response): Response {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }
}
