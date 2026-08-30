import { DOWNLOAD_MAX_MB } from '../config.js';
import { downloadMedia, normalizeMediaUrl } from '../downloader.js';
import {
  formatBytesMb,
  reactTo,
  sendAudio,
  sendDocument,
  sendSignedText,
  sendVideo
} from '../helpers.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

function usage(prefix) {
  return `⚠️ Usage: ${prefix}dl <public media URL>\nAudio only: ${prefix}audio <public media URL>`;
}

async function mediaDownloadCommand(ctx, mode) {
  const { sock, jid, args, message, prefix } = ctx;

  if (!args) {
    await sendSignedText(sock, jid, usage(prefix), { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    let url;
    try {
      url = normalizeMediaUrl(args);
    } catch (error) {
      await sendSignedText(sock, jid, `${error.message}\n\n${usage(prefix)}`, { quoted: message });
      return;
    }

    await sendSignedText(
      sock,
      jid,
      `⏳ Downloading ${mode === 'audio' ? 'audio' : 'media'}... Max size: ${DOWNLOAD_MAX_MB} MB.`,
      { quoted: message }
    );

    const result = await downloadMedia(url, mode);

    try {
      const title = mode === 'audio' ? 'Audio Ready!' : 'Media Ready!';
      const caption = signCaption(`⬇️ *${title}*\n🔗 Source: ${url}\n💾 Size: ${formatBytesMb(result.sizeBytes)}`);

      try {
        if (mode === 'audio') {
          await sendAudio(sock, jid, result.buffer, caption, { quoted: message });
        } else {
          await sendVideo(sock, jid, result.buffer, caption, { quoted: message });
        }
      } catch (sendError) {
        logger.warn({ sendError, mode }, 'Native media send failed, falling back to document');
        await sendDocument(
          sock,
          jid,
          result.buffer,
          result.fileName,
          result.mimetype,
          caption,
          { quoted: message }
        );
      }
    } finally {
      await result.cleanup().catch(() => {});
    }

    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error, mode }, 'Media download command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(
      sock,
      jid,
      `❌ Download failed. Make sure the URL is public, under ${DOWNLOAD_MAX_MB} MB, and yt-dlp/ffmpeg are installed.`,
      { quoted: message }
    );
  }
}

export async function downloadCommand(ctx) {
  await mediaDownloadCommand(ctx, 'video');
}

export async function audioDownloadCommand(ctx) {
  await mediaDownloadCommand(ctx, 'audio');
}
