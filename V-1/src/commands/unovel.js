import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function unovelCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `📗 *Urdu Novels Library*

Usage:
${prefix}unovel categories - Browse categories
${prefix}unovel series - Browse series
${prefix}unovel authors - Browse authors
${prefix}unovel search <query> - Search novels
${prefix}unovel novels <url> - List novels in a category/series
${prefix}unovel detail <url> - Get novel details + download links

Note: URLs must be from the Urdu novels site.`, { quoted: message });
    return;
  }

  try {
    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();
    const rest = parts.slice(1).join(' ');

    await reactTo(sock, jid, message.key, '⏳');

    if (action === 'categories') {
      const data = await fetchJson(`${BASE}/api/unovel?action=categories`, {}, 20000);

      if (!data.ok || !data.categories?.length) {
        await sendSignedText(sock, jid, '❌ No categories found.', { quoted: message });
        return;
      }

      const lines = data.categories.slice(0, 20).map((c, i) => `[${i + 1}] ${c.name || c.title}`);
      await sendSignedText(sock, jid,
        `📂 *Categories*\n\n${lines.join('\n')}\n\nUse ${prefix}unovel novels <categoryUrl> to browse.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'series') {
      const data = await fetchJson(`${BASE}/api/unovel?action=series`, {}, 20000);

      if (!data.ok || !data.series?.length) {
        await sendSignedText(sock, jid, '❌ No series found.', { quoted: message });
        return;
      }

      const lines = data.series.slice(0, 20).map((s, i) => `[${i + 1}] ${s.name || s.title}`);
      await sendSignedText(sock, jid,
        `📚 *Series*\n\n${lines.join('\n')}\n\nUse ${prefix}unovel novels <seriesUrl> to browse.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'authors') {
      const data = await fetchJson(`${BASE}/api/unovel?action=authors`, {}, 20000);

      if (!data.ok || !data.authors?.length) {
        await sendSignedText(sock, jid, '❌ No authors found.', { quoted: message });
        return;
      }

      const lines = data.authors.slice(0, 20).map((a, i) => `[${i + 1}] ${a.name || a.title}`);
      await sendSignedText(sock, jid,
        `✍️ *Authors*\n\n${lines.join('\n')}\n\nUse ${prefix}unovel search <authorName> to find their novels.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'search') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}unovel search <query>`, { quoted: message });
        return;
      }

      const data = await fetchJson(`${BASE}/api/unovel?action=search&q=${encodeURIComponent(rest)}`, {}, 20000);

      if (!data.ok || !data.results?.length) {
        await sendSignedText(sock, jid, `❌ No results for *${rest}*.`, { quoted: message });
        return;
      }

      const lines = data.results.slice(0, 10).map((n, i) =>
        `[${i + 1}] *${n.title || n.name}*${n.author ? ` by ${n.author}` : ''}`
      );

      await sendSignedText(sock, jid,
        `📗 *Search: "${rest}"*\n\n${lines.join('\n\n')}\n\nUse ${prefix}unovel detail <novelUrl> for download links.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'novels') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}unovel novels <url>`, { quoted: message });
        return;
      }

      const data = await fetchJson(`${BASE}/api/unovel?action=novels&url=${encodeURIComponent(rest)}`, {}, 20000);

      if (!data.ok || !data.novels?.length) {
        await sendSignedText(sock, jid, '❌ No novels found.', { quoted: message });
        return;
      }

      const lines = data.novels.slice(0, 15).map((n, i) =>
        `[${i + 1}] *${n.title || n.name}*`
      );

      await sendSignedText(sock, jid,
        `📗 *Novels*\n\n${lines.join('\n')}${data.novels.length > 15 ? `\n\n...and ${data.novels.length - 15} more` : ''}\n\nUse ${prefix}unovel detail <novelUrl> for download links.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'detail') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}unovel detail <url>`, { quoted: message });
        return;
      }

      const data = await fetchJson(`${BASE}/api/unovel?action=detail&url=${encodeURIComponent(rest)}`, {}, 20000);

      if (!data.ok) {
        await sendSignedText(sock, jid, '❌ Could not fetch novel details.', { quoted: message });
        return;
      }

      const meta = data.metadata ? `Author: ${data.metadata.Author || 'N/A'}\nCategory: ${data.metadata.Category || 'N/A'}` : '';
      const downloadLinks = (data.downloadLinks || []).slice(0, 5).map((dl) => `📥 ${dl.text}: ${dl.url}`).join('\n');
      const youtubeLinks = (data.youtubeLinks || []).slice(0, 5).map((yt) => `🎬 ${yt.text}: ${yt.url}`).join('\n');

      const reply = [
        `📗 *Novel Details*`,
        meta,
        downloadLinks ? `\n📥 *Downloads:*\n${downloadLinks}` : '',
        youtubeLinks ? `\n🎬 *YouTube Audio:*\n${youtubeLinks}` : ''
      ].filter(Boolean).join('\n');

      await sendSignedText(sock, jid, reply, { quoted: message });
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    await sendSignedText(sock, jid, `Unknown action. Use ${prefix}unovel for help.`, { quoted: message });
  } catch (error) {
    logger.error({ error }, 'UNovel command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Urdu novels lookup failed. Please try again.', { quoted: message });
  }
}
