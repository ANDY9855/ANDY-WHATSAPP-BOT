import { fetchBuffer, fetchJson } from '../http.js';
import { reactTo, sendImage, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function mangaCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `📚 *Manga Reader*

Usage:
${prefix}manga search <title> - Search manga
${prefix}manga chapters <id> - List chapters
${prefix}manga pages <chapterId> - View chapter pages

Example:
${prefix}manga search naruto`, { quoted: message });
    return;
  }

  try {
    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();
    const query = parts.slice(1).join(' ');

    if (action === 'search') {
      if (!query) {
        await sendSignedText(sock, jid, `Usage: ${prefix}manga search <title>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/manga?action=search&q=${encodeURIComponent(query)}`, {}, 20000);

      if (!data.success || !data.results?.length) {
        await sendSignedText(sock, jid, `❌ No manga found for *${query}*.`, { quoted: message });
        return;
      }

      const lines = data.results.slice(0, 10).map((m, i) =>
        `[${i + 1}] *${m.name}*\nID: ${m.sourceId || m.id}`
      );

      await sendSignedText(sock, jid,
        `📚 *Manga Search: "${query}"*\n\n${lines.join('\n\n')}\n\nUse ${prefix}manga chapters <id> to see chapters.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'chapters') {
      if (!query) {
        await sendSignedText(sock, jid, `Usage: ${prefix}manga chapters <mangaId>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/manga?action=chapters&id=${encodeURIComponent(query)}`, {}, 20000);

      if (!data.success || !data.chapters?.length) {
        await sendSignedText(sock, jid, '❌ No chapters found.', { quoted: message });
        return;
      }

      const lines = data.chapters.slice(0, 15).map((ch, i) =>
        `[${i + 1}] ${ch.title || ch.name || `Chapter ${ch.chapter || ch.id}`}`
      );

      await sendSignedText(sock, jid,
        `📖 *Chapters*\n\n${lines.join('\n')}${data.chapters.length > 15 ? `\n\n...and ${data.chapters.length - 15} more` : ''}\n\nUse ${prefix}manga pages <chapterId> to read.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'pages') {
      if (!query) {
        await sendSignedText(sock, jid, `Usage: ${prefix}manga pages <chapterId>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/manga?action=pages&id=${encodeURIComponent(query)}`, {}, 30000);

      if (!data.success || !data.pages?.length) {
        await sendSignedText(sock, jid, '❌ No pages found.', { quoted: message });
        return;
      }

      const pages = data.pages.slice(0, 10);
      for (let i = 0; i < pages.length; i += 1) {
        const pageUrl = pages[i].url || pages[i].src || pages[i].image;
        if (!pageUrl) continue;
        try {
          const { buffer } = await fetchBuffer(pageUrl, {}, 30000);
          await sendImage(sock, jid, buffer, `📖 Page ${i + 1}/${data.pages.length}`, { quoted: message });
        } catch {
          logger.warn({ page: i, url: pageUrl }, 'Failed to fetch manga page');
        }
      }

      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    await sendSignedText(sock, jid, `Unknown action. Use ${prefix}manga for help.`, { quoted: message });
  } catch (error) {
    logger.error({ error }, 'Manga command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Manga lookup failed. Please try again.', { quoted: message });
  }
}
