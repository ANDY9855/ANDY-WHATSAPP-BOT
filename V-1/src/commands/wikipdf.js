import { fetchBuffer, HttpError } from '../http.js';
import { formatBytesMb, reactTo, sendDocument, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

function cleanFilename(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'Wikipedia_Article';
}

function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return fallback;
    }
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() || fallback;
}

function usage(prefix = BOT_PREFIX) {
  return `Usage: ${prefix}wikipdf <article name>\nExample: ${prefix}wikipdf Babar Azam`;
}

export async function wikipdfCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  const query = args?.trim();

  if (!query) {
    await sendSignedText(sock, jid, usage(prefix), { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, `Generating Wikipedia PDF for "${query}"...`, { quoted: message });

    const { buffer, response } = await fetchBuffer(
      `${BASE}/api/wikster?q=${encodeURIComponent(query)}`,
      {},
      60000
    );

    const fallbackName = `Wikipedia-${cleanFilename(query)}.pdf`;
    const filename = filenameFromDisposition(response.headers.get('content-disposition'), fallbackName);
    const mimetype = response.headers.get('content-type') || 'application/pdf';
    const size = formatBytesMb(response.headers.get('content-length') || buffer.length);

    await sendDocument(
      sock,
      jid,
      buffer,
      filename,
      mimetype,
      signCaption(`*Wikipedia PDF Ready!*\nArticle: ${query}\nFile: ${filename}\nSize: ${size}`),
      { quoted: message }
    );

    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error, query }, 'Wikipedia PDF command failed');
    await reactTo(sock, jid, message.key, '❌');

    if (error instanceof HttpError) {
      if (error.status === 404) {
        await sendSignedText(sock, jid, `No Wikipedia article found for "${query}". Try a more specific name.`, {
          quoted: message
        });
        return;
      }

      if (error.status === 400) {
        await sendSignedText(sock, jid, usage(prefix), { quoted: message });
        return;
      }

      await sendSignedText(sock, jid, 'Wikipedia PDF service returned an error. Please try again.', {
        quoted: message
      });
      return;
    }

    if (error.name === 'AbortError') {
      await sendSignedText(sock, jid, 'Wikipedia PDF generation timed out. Please try again.', { quoted: message });
      return;
    }

    await sendSignedText(sock, jid, 'Wikipedia PDF generation failed. Please try again.', { quoted: message });
  }
}
