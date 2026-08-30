import { fetchBuffer } from '../http.js';
import { formatBytesMb, reactTo, sendImage, sendDocument, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

function normalizeUrl(input) {
  const value = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  return new URL(value).toString();
}

export async function websnapCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}screenshot <url>\nOr: ${prefix}screenshot <url> | pdf`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    let url;
    let format = 'png';
    if (args.includes(' | ')) {
      const parts = args.split(' | ');
      url = parts[0].trim();
      format = parts[1]?.trim().toLowerCase() || 'png';
    } else {
      url = args.trim();
    }

    if (!['png', 'pdf'].includes(format)) format = 'png';

    let normalizedUrl;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      await sendSignedText(sock, jid, `❌ Invalid URL. Example: ${prefix}screenshot https://example.com`, { quoted: message });
      return;
    }

    await sendSignedText(sock, jid, '⏳ Capturing screenshot...', { quoted: message });

    const { buffer, response } = await fetchBuffer(
      `${BASE}/api/websnap?url=${encodeURIComponent(normalizedUrl)}&format=${format}`,
      {},
      60000
    );

    const size = formatBytesMb(response.headers.get('content-length') || buffer.length);

    if (format === 'pdf') {
      const hostname = new URL(normalizedUrl).hostname.replace(/[^a-z0-9.-]/gi, '-');
      await sendDocument(
        sock, jid, buffer, `${hostname}.pdf`, 'application/pdf',
        signCaption(`📸 *Screenshot as PDF*\n🌐 ${normalizedUrl}\n💾 ${size}`),
        { quoted: message }
      );
    } else {
      await sendImage(
        sock, jid, buffer,
        signCaption(`📸 *Screenshot*\n🌐 ${normalizedUrl}\n💾 ${size}`),
        { quoted: message }
      );
    }

    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'WebSnap command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Screenshot failed. The website might be too large or unreachable.', { quoted: message });
  }
}
