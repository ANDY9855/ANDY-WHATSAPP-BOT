import { fetchBuffer } from '../http.js';
import { reactTo, sendAudio, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const MAX_CHUNK_LENGTH = 1950;

function splitText(text, maxLen = MAX_CHUNK_LENGTH) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length > maxLen) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      for (let i = 0; i < trimmed.length; i += maxLen) {
        chunks.push(trimmed.slice(i, i + maxLen));
      }
      continue;
    }

    if ((current + ' ' + trimmed).trim().length > maxLen) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = `${current} ${trimmed}`.trim();
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

const VOICE_MAP = {
  1: 'en-US',
  2: 'en-GB',
  3: 'en-AU',
  4: 'en-IN',
  5: 'ur-PK'
};

const VOICE_DISPLAY = {
  1: 'en-US - American English',
  2: 'en-GB - British English',
  3: 'en-AU - Australian English',
  4: 'en-IN - Indian English',
  5: 'ur-PK - Urdu (Pakistan)'
};

function getVoices() {
  return Object.entries(VOICE_DISPLAY).map(([index, name]) => ({
    index: Number(index),
    name
  }));
}

export async function voicesCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  try {
    await reactTo(sock, jid, message.key, '⏳');
    const voices = getVoices();
    const filter = args?.trim().toLowerCase();
    const filtered = filter
      ? voices.filter((voice) => String(voice.name).toLowerCase().includes(filter))
      : voices;

    if (filtered.length === 0) {
      await sendSignedText(sock, jid, `❌ No voices found for *${args}*.`, { quoted: message });
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    const shown = filtered.slice(0, 20);
    const lines = shown.map(
      (voice) => `[${voice.index}] ${voice.name}`
    );

    const heading = filter
      ? `🎙️ *Available Voices for "${args}" (showing ${shown.length} of ${filtered.length})*`
      : `🎙️ *Available Voices (showing ${shown.length} of ${voices.length})*`;

    await sendSignedText(
      sock,
      jid,
      `${heading}\n\n${lines.join('\n')}\n\nUse: ${prefix}tts <voiceIndex> | <your text>`,
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Voices command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Could not load voices. Please try again.', { quoted: message });
  }
}

export async function ttsCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}tts <text>\nOr: ${prefix}tts <voiceIndex> | <text>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, '⏳ Processing your request...', { quoted: message });

    let voiceIndex = 1;
    let text = args.trim();

    if (args.includes(' | ')) {
      const parts = args.split(' | ');
      const maybeIndex = Number.parseInt(parts[0].trim(), 10);
      if (Number.isInteger(maybeIndex)) {
        voiceIndex = maybeIndex;
        text = parts.slice(1).join(' | ').trim();
      }
    }

    if (!text) {
      await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}tts <text>\nOr: ${prefix}tts <voiceIndex> | <text>`, { quoted: message });
      return;
    }

    const voices = getVoices();
    const selected = voices.find((voice) => voice.index === voiceIndex);
    if (!selected) {
      await sendSignedText(sock, jid, `❌ Voice index ${voiceIndex} was not found. Use ${prefix}voices to list voices.`, {
        quoted: message
      });
      return;
    }

    const voice = VOICE_MAP[voiceIndex] || 'en-US';
    const chunks = splitText(text);
    const buffers = await Promise.all(
      chunks.map((chunk) =>
        fetchBuffer(
          `${BASE}/api/tts?text=${encodeURIComponent(chunk)}&voice=${encodeURIComponent(voice)}`,
          {},
          30000
        ).then(({ buffer }) => buffer)
      )
    );

    await sendAudio(
      sock,
      jid,
      Buffer.concat(buffers),
      signCaption(`🎙️ Here is your audio!\nVoice: ${selected.name}`),
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'TTS command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ TTS failed. Please try again.', { quoted: message });
  }
}
