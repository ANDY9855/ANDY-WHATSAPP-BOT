/**
 * TTS API Server for WHATSAPP_BOT_404 V-2
 *
 * Implements:
 *   POST /api/tts    → { voiceIndex, text, pitch, rate } → raw audio/mpeg bytes
 *   GET  /api/voices → { voices: [{ index, name, language }] }
 *
 * Powered by Microsoft Edge Read-Aloud neural voices via `msedge-tts`.
 * No API keys required.
 */

require('dotenv').config();
const express = require('express');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Gemini Text Preprocessing ───────────────────────────────────────────────

/**
 * Uses Gemini API to preprocess text before TTS:
 * - Converts Roman Urdu to proper Urdu script
 * - Fixes spelling/grammar mistakes
 * - Returns ONLY corrected Urdu text
 * - Gracefully falls back to original text if Gemini API is unavailable/fails
 */
async function preprocessTextWithGemini(inputText) {
  const matchingKeys = Object.keys(process.env).filter(k => /^GEMINI_API_KEY(_\d+)?$/i.test(k));
  const rawList = matchingKeys.map(k => process.env[k]).flatMap(k => (k ? k.split(',') : [])).map(k => k.trim()).filter(Boolean);
  const keys = Array.from(new Set(rawList));

  if (keys.length === 0) {
    console.log('[TTS_API Gemini] No GEMINI_API_KEY configured, skipping preprocessing.');
    return inputText;
  }

  const prompt = "If this text is Roman Urdu (Urdu written in English letters), convert it to proper Urdu script and fix spelling/grammar. If this text is already in English or another language, leave it completely unchanged except for obvious typo fixes. Return ONLY the resulting text with no explanation or extra formatting.";
  const models = ['gemini-2.0-flash', 'gemini-3.6-flash', 'gemini-1.5-flash'];

  for (const key of keys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: prompt }]
            },
            contents: [
              { parts: [{ text: inputText }] }
            ]
          })
        });

        clearTimeout(timeoutId);

        if (response.status === 404) {
          continue; // Try next model in list if model version deprecated
        }

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[TTS_API Gemini] API warning (${model}, status ${response.status}): ${errText.slice(0, 100)}`);
          continue;
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (resultText) {
          console.log(`[TTS_API Gemini] Preprocessed (${model}): "${inputText}" -> "${resultText}"`);
          return resultText;
        }
      } catch (err) {
        console.warn(`[TTS_API Gemini] Call error (${model}): ${err.message}`);
      }
    }
  }

  console.warn('[TTS_API Gemini] All Gemini API attempts failed. Falling back to original input text.');
  return inputText;
}

// ── Queue & Retry Logic for Audio Generation ────────────────────────────────

let ttsQueue = Promise.resolve();

function enqueueTTS(fn) {
  const res = ttsQueue.then(fn);
  ttsQueue = res.catch(() => {});
  return res;
}

function renderAudioStream(voiceId, text, prosody) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
    };

    const doneResolve = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const doneReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    timer = setTimeout(() => {
      doneReject(new Error(`TTS stream timed out after 12000ms for voice ${voiceId}`));
    }, 12000);

    const tts = new MsEdgeTTS();
    tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      .then(() => tts.toStream(text.slice(0, 2000), prosody))
      .then((readable) => {
        const chunks = [];
        const stream = readable.audioStream ?? readable;

        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const audioBuffer = Buffer.concat(chunks);
          doneResolve(audioBuffer);
        });

        stream.on('error', (err) => {
          console.error(`[TTS_API] Stream error for voice ${voiceId}:`, err.stack || err.message || err);
          doneReject(err);
        });

        stream.on('close', () => {
          if (!settled) {
            const audioBuffer = Buffer.concat(chunks);
            doneResolve(audioBuffer);
          }
        });
      })
      .catch((err) => {
        console.error(`[TTS_API] WebSocket/metadata setup error for voice ${voiceId}:`, err.stack || err.message || err);
        doneReject(err);
      });
  });
}

async function generateAudioWithRetry(voiceId, text, prosody) {
  return enqueueTTS(async () => {
    // 400ms delay between consecutive requests to prevent WebSocket collisions
    await new Promise((r) => setTimeout(r, 400));

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[TTS_API] Generating audio (attempt ${attempt}/2) for voice ${voiceId}...`);
        const buffer = await renderAudioStream(voiceId, text, prosody);
        if (buffer && buffer.length > 0) {
          return buffer;
        }
        console.warn(`[TTS_API] Empty audio buffer (0.0 KB) received on attempt ${attempt}/2 for voice ${voiceId}`);
      } catch (err) {
        console.error(`[TTS_API] Audio generation failed on attempt ${attempt}/2 for voice ${voiceId}: ${err.message}`);
      }

      if (attempt < 2) {
        console.log(`[TTS_API] Retrying audio generation (attempt 2/2) after 500ms delay...`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    throw new Error(`Failed to generate TTS audio for voice ${voiceId} after 2 attempts.`);
  });
}

// ── Voice catalogue (built once at startup) ─────────────────────────────────

let VOICES = [];          // [{ index, name, id, language }]
let voicesReady = false;

async function loadVoices() {
  try {
    const tts = new MsEdgeTTS();
    const raw = await tts.getVoices();
    VOICES = raw.map((v, i) => ({
      index: i + 1,
      id: v.ShortName,
      name: v.FriendlyName ?? v.ShortName,
      language: v.Locale ?? v.ShortName.split('-').slice(0, 2).join('-'),
      gender: v.Gender ?? 'Unknown',
    }));
    voicesReady = true;
    console.log(`[TTS_API] Loaded ${VOICES.length} neural voices`);
  } catch (err) {
    console.error('[TTS_API] Failed to load voices:', err.message);
    // Retry in 5 s
    setTimeout(loadVoices, 5000);
  }
}

// ── GET /api/voices ─────────────────────────────────────────────────────────

app.get('/api/voices', (_req, res) => {
  if (!voicesReady) return res.status(503).json({ success: false, error: 'Voice list still loading, try again in a few seconds.' });
  res.json({ voices: VOICES });
});

// ── POST /api/tts ───────────────────────────────────────────────────────────
//
// Bot sends:  { voiceIndex: number, text: string, pitch?: number, rate?: number }
// We return:  raw MP3 audio bytes  (Content-Type: audio/mpeg)

app.post('/api/tts', async (req, res) => {
  try {
    const { voiceIndex = 314, text = '', pitch = 0, rate = 0 } = req.body ?? {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or empty "text" field.' });
    }

    if (!voicesReady || VOICES.length === 0) {
      return res.status(503).json({ success: false, error: 'Voice catalogue not loaded yet.' });
    }

    // Resolve voice by index (1-based) – fall back to voice 1 if out of range
    const idx = Math.max(1, Math.min(Number(voiceIndex) || 1, VOICES.length));
    const voice = VOICES[idx - 1];

    console.log(`[TTS_API] Request: voice=${voice.id} (${idx}), text=${text.slice(0, 80)}…, pitch=${pitch}, rate=${rate}`);

    // Preprocess text with Gemini API (Roman Urdu -> Urdu script, fix spelling/grammar)
    const textToSpeech = await preprocessTextWithGemini(text);

    // Build SSML-style pitch/rate strings if provided
    const prosody = {};
    if (pitch !== 0) prosody.pitch = `${pitch >= 0 ? '+' : ''}${pitch}Hz`;
    if (rate !== 0)  prosody.rate  = `${rate >= 0 ? '+' : ''}${rate}%`;

    // Generate audio with queue, delay, and retry
    const audioBuffer = await generateAudioWithRetry(voice.id, textToSpeech, prosody);

    console.log(`[TTS_API] Generated ${(audioBuffer.length / 1024).toFixed(1)} KB audio for voice=${voice.id} (${idx})`);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length);
    res.send(audioBuffer);

  } catch (err) {
    console.error('[TTS_API] TTS error:', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', voices: VOICES.length, ready: voicesReady });
});

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.TTS_PORT || 3000;

loadVoices().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TTS_API] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[TTS_API] Endpoints: POST /api/tts, GET /api/voices, GET /health`);
  });
});
