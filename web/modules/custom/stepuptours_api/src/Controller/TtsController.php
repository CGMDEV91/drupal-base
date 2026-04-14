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

    // Decodificar el body forzando UTF-8 válido.
    $raw  = $request->getContent();
    $data = json_decode($raw, TRUE);

    if (!is_array($data)) {
      return $this->corsResponse(new Response('Invalid JSON body', 400));
    }

    $rawText   = trim((string) ($data['text']      ?? ''));
    $langcode  = strtolower(trim((string) ($data['langcode']  ?? 'en')));
    $tourTitle = trim((string) ($data['tourTitle'] ?? ''));
    $stepTitle = trim((string) ($data['stepTitle'] ?? ''));

    if ($rawText === '') {
      return $this->corsResponse(new Response('Missing text', 400));
    }

    // Rechazar texto con encoding inválido (evita corrupción silenciosa en
    // idiomas no-latinos como griego, árabe, japonés, etc.).
    if (!mb_check_encoding($rawText, 'UTF-8')) {
      return $this->corsResponse(new Response('Text is not valid UTF-8', 400));
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
      $tmpTxt = tempnam(sys_get_temp_dir(), 'tts_txt_');

      // Escribir el texto en un fichero temporal para evitar cualquier problema
      // de encoding en los argumentos de shell con caracteres multibyte
      // (griego, árabe, chino, etc.).
      file_put_contents($tmpTxt, $text, LOCK_EX);

      // Verificar que el fichero temporal se escribió correctamente y contiene
      // exactamente el texto esperado (detecta fallos de disco/permisos).
      $written = file_get_contents($tmpTxt);
      if ($written !== $text) {
        @unlink($tmpTxt);
        \Drupal::logger('stepuptours_tts')->error(
          'TTS: failed to write temp text file for langcode @lang',
          ['@lang' => $langcode],
        );
        // Fall through to Railway fallback.
        goto railway;
      }

      $cmd = sprintf(
        'PYTHONIOENCODING=utf-8 LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 %s --voice %s --text-file %s --write-media %s',
        escapeshellarg($bin),
        escapeshellarg($voice),
        escapeshellarg($tmpTxt),
        escapeshellarg($tmpOut),
      );

      // Usar proc_open en lugar de exec() para garantizar que esperamos a que
      // el proceso hijo termine de escribir y cerrar el fichero MP3 antes de
      // continuar. exec() puede retornar antes de que el proceso hijo haya
      // volcado todos los buffers, lo que produce ficheros con padding LAME
      // (bloques de "UUUUU...") al final.
      $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
      ];
      $process  = proc_open($cmd, $descriptors, $pipes);
      $exitCode = -1;
      $stderr   = '';

      if (is_resource($process)) {
        fclose($pipes[0]);
        // Leer stderr antes de proc_close para evitar deadlock en buffers.
        $stderr   = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process); // bloquea hasta que el proceso termina
      }

      @unlink($tmpTxt);

      // Tamaño mínimo razonable: 5 KB. Un fichero menor casi seguro está
      // corrupto o vacío. Los bloques "UUUUU..." de LAME indican que el proceso
      // se interrumpió antes de cerrar el MP3 correctamente.
      $fileSize = (file_exists($tmpOut) ? filesize($tmpOut) : 0);

      if ($exitCode === 0 && $fileSize > 5000) {
        rename($tmpOut, $cacheRealDir . "/{$filename}");
        return $this->urlResponse($filename);
      }

      @unlink($tmpOut);
      \Drupal::logger('stepuptours_tts')->error(
        'edge-tts failed: exit=@exit size=@size stderr=@err',
        ['@exit' => $exitCode, '@size' => $fileSize, '@err' => $stderr],
      );
      // Fall through to Railway fallback.
    }

    // ── 3b. Railway microservice fallback ─────────────────────────────────────
    railway:
    $railwayUrl = getenv('STEPUPTOURS_TTS_RAILWAY_URL') ?: '';
    if ($railwayUrl === '') {
      return $this->corsResponse(new Response(
        'TTS unavailable: edge-tts not found and STEPUPTOURS_TTS_RAILWAY_URL not configured.',
        501,
      ));
    }

    $endpoint = rtrim($railwayUrl, '/') . '/tts';
    $payload  = json_encode(['text' => $text, 'langcode' => $langcode], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
      CURLOPT_POST           => TRUE,
      CURLOPT_POSTFIELDS     => $payload,
      CURLOPT_HTTPHEADER     => ['Content-Type: application/json; charset=utf-8'],
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
    // Intentar transliteración ASCII (funciona bien para latín, cirílico, etc.)
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str) ?: '';
    $ascii = strtolower($ascii);
    $ascii = preg_replace('/[^a-z0-9]+/', '-', $ascii);
    $ascii = trim($ascii, '-');
    $ascii = substr($ascii, 0, 30);

    // Si el resultado es demasiado corto (texto no transliterable: griego,
    // árabe, chino, coreano, japonés...), usar un hash corto del original
    // en lugar de un slug inútil tipo "u-u-u-".
    if (strlen($ascii) < 4) {
      return substr(hash('sha256', mb_strtolower(trim($str))), 0, 12);
    }

    return $ascii;
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
