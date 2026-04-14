"""
StepUp Tours — TTS Microservice
Wraps edge-tts CLI and exposes a simple HTTP endpoint.
Deploy on Railway, Render, or any platform that supports Python.
"""

import os
import subprocess
import tempfile
from flask import Flask, request, Response

app = Flask(__name__)

# ── Voice map: Drupal langcode → Edge TTS neural voice ────────────────────────

VOICES = {
    'es': 'es-ES-AlvaroNeural',
    'en': 'en-US-GuyNeural',
    'fr': 'fr-FR-HenriNeural',
    'de': 'de-DE-ConradNeural',
    'it': 'it-IT-DiegoNeural',
    'pt': 'pt-BR-AntonioNeural',
    'nl': 'nl-NL-MaartenNeural',
    'pl': 'pl-PL-MarekNeural',
    'ru': 'ru-RU-DmitryNeural',
    'ja': 'ja-JP-KeitaNeural',
    'zh': 'zh-CN-YunxiNeural',
    'ar': 'ar-SA-HamedNeural',
    'ca': 'ca-ES-EnricNeural',
    'eu': 'eu-ES-AnderNeural',
    'ko': 'ko-KR-InJoonNeural',
    'el' => 'el-GR-NestorasNeural',
}

DEFAULT_VOICE = 'en-US-GuyNeural'


def resolve_voice(langcode: str) -> str:
    short = langcode[:2].lower()
    return VOICES.get(short, DEFAULT_VOICE)


def cors_headers(response: Response) -> Response:
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/tts', methods=['OPTIONS'])
def tts_preflight():
    return cors_headers(Response('', 204))


@app.route('/tts', methods=['POST'])
def synthesize():
    data = request.get_json(force=True, silent=True) or {}
    text = (data.get('text') or '').strip()
    langcode = (data.get('langcode') or 'en').strip()

    if not text:
        return cors_headers(Response('Missing text', 400))

    voice = resolve_voice(langcode)

    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
        output_path = tmp.name

    try:
        result = subprocess.run(
            ['edge-tts', '--voice', voice, '--text', text, '--write-media', output_path],
            capture_output=True,
            timeout=60,
        )
        if result.returncode != 0 or not os.path.exists(output_path):
            error = result.stderr.decode('utf-8', errors='replace')
            return cors_headers(Response(f'TTS error: {error}', 502))

        with open(output_path, 'rb') as f:
            audio = f.read()

    finally:
        try:
            os.unlink(output_path)
        except OSError:
            pass

    resp = Response(audio, status=200, mimetype='audio/mpeg')
    resp.headers['Content-Length'] = str(len(audio))
    resp.headers['Cache-Control'] = 'no-store'
    return cors_headers(resp)


@app.route('/health', methods=['GET'])
def health():
    return cors_headers(Response('ok', 200))


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    app.run(host='0.0.0.0', port=port)
