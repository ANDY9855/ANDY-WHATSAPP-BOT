import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { fetchBuffer, fetchJson } from '../http.js';
import { reactTo, sendImage, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { watermarkImage } from '../media.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const ALLOWED_RATIOS = new Set(['1:1', '1:2', '2:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9']);
const ALLOWED_PTI_RATIOS = new Set(['1:1', '1:2', '2:1', '2:3', '3:2', '9:16', '16:9', 'auto']);
const MAX_PTI_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024);

function parseSingleImageArgs(args) {
  if (!args.includes(' | ')) {
    return { prompt: args.trim(), ratio: '1:1', ratioWasDefaulted: false };
  }

  const parts = args.split(' | ');
  const prompt = parts[0].trim();
  const requestedRatio = parts[1]?.trim() || '1:1';
  const ratioWasDefaulted = !ALLOWED_RATIOS.has(requestedRatio);

  return {
    prompt,
    ratio: ratioWasDefaulted ? '1:1' : requestedRatio,
    ratioWasDefaulted
  };
}

function parseImageToImageArgs(args) {
  if (!args.includes(' | ')) {
    return { prompt: args.trim(), ratio: 'auto', ratioWasDefaulted: false };
  }

  const parts = args.split(' | ');
  const prompt = parts[0].trim();
  const requestedRatio = parts[1]?.trim() || 'auto';
  const ratioWasDefaulted = !ALLOWED_PTI_RATIOS.has(requestedRatio);

  return {
    prompt,
    ratio: ratioWasDefaulted ? 'auto' : requestedRatio,
    ratioWasDefaulted
  };
}

async function generateImage(prompt, ratio) {
  const data = await fetchJson(
    `${BASE}/api/pixel?prompt=${encodeURIComponent(prompt)}&type=image`,
    {},
    60000
  );

  const mediaUrl = data.imageUrl || data.url || data.mediaUrl;
  if (!mediaUrl) {
    throw new Error('Image API did not return a media URL.');
  }

  const { buffer } = await fetchBuffer(mediaUrl, {}, 60000);
  return watermarkImage(buffer);
}

async function transformImage(prompt, ratio, imageBase64) {
  const data = await fetchJson(
    `${BASE}/api/pixel?prompt=${encodeURIComponent(prompt)}&type=image`,
    {},
    90000
  );

  const mediaUrl = data.imageUrl || data.url || data.mediaUrl;
  if (!mediaUrl) {
    throw new Error('Image-to-image API did not return a media URL.');
  }

  const { buffer } = await fetchBuffer(mediaUrl, {}, 60000);
  return watermarkImage(buffer);
}

function getImageMessageForDownload(message, quotedMsg) {
  if (message.message?.imageMessage) {
    return message;
  }

  if (quotedMsg?.imageMessage) {
    return {
      key: message.key,
      message: quotedMsg
    };
  }

  return null;
}

async function getSourceImageBase64(message, quotedMsg) {
  const imageMessage = getImageMessageForDownload(message, quotedMsg);
  if (!imageMessage) return null;

  const buffer = await downloadMediaMessage(imageMessage, 'buffer', {});
  if (buffer.length > MAX_PTI_IMAGE_BYTES) {
    const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);
    const limitMb = (MAX_PTI_IMAGE_BYTES / 1024 / 1024).toFixed(1);
    throw new Error(`SOURCE_IMAGE_TOO_LARGE:${sizeMb}:${limitMb}`);
  }

  return buffer.toString('base64');
}

export async function imageCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `Usage: ${prefix}img <prompt>\nOr: ${prefix}img <prompt> | <ratio>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '\u23f3');
    await sendSignedText(sock, jid, 'Processing your request...', { quoted: message });

    if (args.toLowerCase().startsWith('bulk ')) {
      const prompts = args
        .slice(5)
        .split(' | ')
        .map((prompt) => prompt.trim())
        .filter(Boolean)
        .slice(0, 50);

      if (!prompts.length) {
        await sendSignedText(sock, jid, `Usage: ${prefix}img bulk <prompt1> | <prompt2> | <prompt3>`, { quoted: message });
        return;
      }

      const results = await Promise.allSettled(prompts.map((prompt) => generateImage(prompt, '1:1')));
      let sent = 0;

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        if (result.status !== 'fulfilled') {
          logger.warn({ prompt: prompts[i], error: result.reason }, 'Bulk image item failed');
          continue;
        }

        sent += 1;
        await sendImage(
          sock,
          jid,
          result.value,
          signCaption(`*Generated Image ${sent}/${prompts.length}*\nPrompt: _${prompts[i]}_\nRatio: 1:1`),
          { quoted: message }
        );
      }

      if (!sent) {
        await sendSignedText(sock, jid, 'Image generation failed. The AI might be busy. Please retry.', {
          quoted: message
        });
        return;
      }

      await reactTo(sock, jid, message.key, '\u2705');
      return;
    }

    const { prompt, ratio, ratioWasDefaulted } = parseSingleImageArgs(args);
    if (!prompt) {
      await sendSignedText(sock, jid, `Usage: ${prefix}img <prompt>\nOr: ${prefix}img <prompt> | <ratio>`, { quoted: message });
      return;
    }

    const image = await generateImage(prompt, ratio);
    const note = ratioWasDefaulted ? '\nInvalid ratio received, defaulted to 1:1.' : '';

    await sendImage(
      sock,
      jid,
      image,
      signCaption(`*Generated Image*\nPrompt: _${prompt}_\nRatio: ${ratio}${note}`),
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '\u2705');
  } catch (error) {
    logger.error({ error }, 'Image command failed');
    await reactTo(sock, jid, message.key, '\u274c');
    await sendSignedText(sock, jid, 'Image generation failed. The AI might be busy. Please retry.', {
      quoted: message
    });
  }
}

export async function imageToImageCommand({ sock, jid, args, message, quotedMsg, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(
      sock,
      jid,
      `Usage: reply to an image with ${prefix}i2i <prompt>\nOr send an image with caption: ${prefix}i2i <prompt> | <ratio>`,
      { quoted: message }
    );
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '\u23f3');
    await sendSignedText(sock, jid, 'Transforming your image...', { quoted: message });

    const { prompt, ratio, ratioWasDefaulted } = parseImageToImageArgs(args);
    if (!prompt) {
      await sendSignedText(
        sock,
        jid,
        `Usage: reply to an image with ${prefix}i2i <prompt>\nOr send an image with caption: ${prefix}i2i <prompt> | <ratio>`,
        { quoted: message }
      );
      return;
    }

    const imageBase64 = await getSourceImageBase64(message, quotedMsg);
    if (!imageBase64) {
      await sendSignedText(sock, jid, `Please reply to an image, or send an image with caption ${prefix}i2i <prompt>.`, {
        quoted: message
      });
      return;
    }

    const image = await transformImage(prompt, ratio, imageBase64);
    const note = ratioWasDefaulted ? '\nInvalid ratio received, defaulted to auto.' : '';

    await sendImage(
      sock,
      jid,
      image,
      signCaption(`*Transformed Image*\nPrompt: _${prompt}_\nRatio: ${ratio}${note}`),
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '\u2705');
  } catch (error) {
    logger.error({ error }, 'Image-to-image command failed');
    await reactTo(sock, jid, message.key, '\u274c');

    if (error.message?.startsWith('SOURCE_IMAGE_TOO_LARGE:')) {
      const [, sizeMb, limitMb] = error.message.split(':');
      await sendSignedText(sock, jid, `Source image is too large (${sizeMb} MB). Please use an image under ${limitMb} MB.`, {
        quoted: message
      });
      return;
    }

    await sendSignedText(sock, jid, 'Image transformation failed. The AI might be busy. Please retry.', {
      quoted: message
    });
  }
}
