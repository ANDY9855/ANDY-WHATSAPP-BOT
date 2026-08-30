import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const MAX_IMAGE_BYTES = Math.floor(8 * 1024 * 1024);

function getImageMessage(message, quotedMsg) {
  if (message.message?.imageMessage) return message;
  if (quotedMsg?.imageMessage) {
    return { key: message.key, message: quotedMsg };
  }
  return null;
}

async function imageToBase64(message, quotedMsg) {
  const imgMsg = getImageMessage(message, quotedMsg);
  if (!imgMsg) return null;
  const buffer = await downloadMediaMessage(imgMsg, 'buffer', {});
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`IMAGE_TOO_LARGE:${(buffer.length / 1024 / 1024).toFixed(2)}`);
  }
  const mime = imgMsg.message?.imageMessage?.mimetype || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function visionCommand({ sock, jid, args, message, quotedMsg, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `Usage: reply to an image with ${prefix}vision <question>\nOr send an image with caption: ${prefix}vision <question>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, '⏳ Analyzing image...', { quoted: message });

    const imageDataUrl = await imageToBase64(message, quotedMsg);
    if (!imageDataUrl) {
      await sendSignedText(sock, jid, `Please reply to an image or send an image with caption ${prefix}vision <question>.`, { quoted: message });
      return;
    }

    const data = await fetchJson(
      `${BASE}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl, userPrompt: args })
      },
      60000
    );

    if (!data.success || !data.response) {
      await sendSignedText(sock, jid, '❌ Could not analyze the image. Please try again.', { quoted: message });
      return;
    }

    await sendSignedText(sock, jid, `👁️ *Vision Analysis:*\n${data.response}`, { quoted: message });
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Vision command failed');
    await reactTo(sock, jid, message.key, '❌');

    if (error.message?.startsWith('IMAGE_TOO_LARGE:')) {
      const size = error.message.split(':')[1];
      await sendSignedText(sock, jid, `Image is too large (${size} MB). Max 8 MB.`, { quoted: message });
      return;
    }

    await sendSignedText(sock, jid, '❌ Vision analysis failed. Please try again.', { quoted: message });
  }
}
