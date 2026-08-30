import { fetchBuffer, HttpError } from '../http.js';
import { formatBytesMb, reactTo, sendDocument, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

function normalizeUrl(input) {
  const value = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  return new URL(value).toString();
}

export async function webzipCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}zip <url>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    let url;
    try {
      url = normalizeUrl(args);
    } catch {
      await sendSignedText(sock, jid, `❌ Please send a valid URL. Example: ${prefix}zip https://example.com`, {
        quoted: message
      });
      return;
    }

    await sendSignedText(sock, jid, '⏳ Archiving website... This may take up to 75 seconds.', { quoted: message });

    const { buffer, response } = await fetchBuffer(
      `${BASE}/api/zip`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      },
      80000
    );

    const hostname = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '-');
    const filename = response.headers.get('x-file-name') || `${hostname}-archive.zip`;
    const size = formatBytesMb(response.headers.get('content-length') || buffer.length);

    await sendDocument(
      sock,
      jid,
      buffer,
      filename,
      'application/zip',
      signCaption(`📦 *Website Archive Ready!*\n🌐 URL: ${url}\n📁 File: ${filename}\n💾 Size: ${size}`),
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'WebZip command failed');
    await reactTo(sock, jid, message.key, '❌');
    if (error.name === 'AbortError' || error.status === 504 || error instanceof HttpError) {
      await sendSignedText(sock, jid, '⏰ Archive timed out or failed. The website might be too large. Try again.', {
        quoted: message
      });
      return;
    }

    await sendSignedText(sock, jid, '❌ Website archive failed. Please try again.', { quoted: message });
  }
}
