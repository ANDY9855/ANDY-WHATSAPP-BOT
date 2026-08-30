import { fetchBuffer, fetchJson } from '../http.js';
import { reactTo, sendImage, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { watermarkImage } from '../media.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

function formatYear(result) {
  if (result.year && result.yearEnd) return `${result.year}-${result.yearEnd}`;
  return result.year || 'N/A';
}

export async function movieCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}movie <title>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    const data = await fetchJson(`${BASE}/api/cine?q=${encodeURIComponent(args)}`, {}, 20000);

    if (!data.success || data.total === 0 || !data.results?.length) {
      await sendSignedText(sock, jid, `❌ No results found for *${args}*.`, { quoted: message });
      return;
    }

    const results = data.results.slice(0, 5);
    const topPoster = results.find((result) => result.poster);

    if (topPoster) {
      try {
        const { buffer } = await fetchBuffer(topPoster.poster, {}, 20000);
        const poster = await watermarkImage(buffer);
        await sendImage(
          sock,
          jid,
          poster,
          signCaption(`🎬 *${topPoster.title}*\n▶️ Watch: ${topPoster.watchUrl}`),
          { quoted: message }
        );
      } catch (error) {
        logger.warn({ error }, 'Movie poster send failed');
      }
    }

    const body = results
      .map(
        (result, index) => `━━━━━━━━━━━━━━━━━━━━
${index + 1}️⃣ *${result.title}*
🎭 Type: ${result.type || 'N/A'}
📅 Year: ${formatYear(result)}
🌟 IMDB Rank: ${result.rank ? `#${result.rank}` : 'N/A'}
👥 Cast: ${result.cast || 'N/A'}
▶️ Watch: ${result.watchUrl}
📋 IMDB: ${result.imdbUrl}`
      )
      .join('\n\n');

    const note = data.total > 5 ? `\n\nShowing top 5 of ${data.total}. Try a more specific title.` : '';
    await sendSignedText(
      sock,
      jid,
      `🎬 *Search results for: "${data.query || args}"*
📊 Found ${data.total} title(s)

${body}${note}`,
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Movie command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Movie search failed. Please try again.', { quoted: message });
  }
}
