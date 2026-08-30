import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function novelCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `📖 *Novel Reader*

Usage:
${prefix}novel search <title> - Search novels
${prefix}novel chapters <novelId> - List chapters
${prefix}novel read <fileUrl> [en|ur] - Read a chapter

Example:
${prefix}novel search harry potter`, { quoted: message });
    return;
  }

  try {
    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (action === 'search') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}novel search <title>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/novel?action=search&q=${encodeURIComponent(rest)}`, {}, 20000);

      if (!data.success || !data.results?.length) {
        await sendSignedText(sock, jid, `❌ No novels found for *${rest}*.`, { quoted: message });
        return;
      }

      const lines = data.results.slice(0, 10).map((n, i) =>
        `[${i + 1}] *${n.title || n.name}*\nID: ${n.id || n.novelId}`
      );

      await sendSignedText(sock, jid,
        `📖 *Novel Search: "${rest}"*\n\n${lines.join('\n\n')}\n\nUse ${prefix}novel chapters <id> to see chapters.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'chapters') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}novel chapters <novelId>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/novel?action=chapters&novelId=${encodeURIComponent(rest)}`, {}, 20000);

      if (!data.success || !data.chapters?.length) {
        await sendSignedText(sock, jid, '❌ No chapters found.', { quoted: message });
        return;
      }

      const lines = data.chapters.slice(0, 15).map((ch, i) =>
        `[${i + 1}] ${ch.title || ch.name || `Chapter ${ch.chapter || ch.id}`}`
      );

      await sendSignedText(sock, jid,
        `📑 *Chapters*\n\n${lines.join('\n')}${data.chapters.length > 15 ? `\n\n...and ${data.chapters.length - 15} more` : ''}\n\nUse ${prefix}novel read <fileUrl> to read.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'read') {
      if (!rest) {
        await sendSignedText(sock, jid, `Usage: ${prefix}novel read <fileUrl> [en|ur]\nDefault language: en`, { quoted: message });
        return;
      }

      const readParts = rest.split(/\s+/);
      const fileUrl = readParts[0];
      const lang = readParts[1]?.toLowerCase() || 'en';

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(
        `${BASE}/api/novel?action=read&fileUrl=${encodeURIComponent(fileUrl)}&lang=${lang}`,
        {},
        20000
      );

      if (!data.success || !data.content) {
        await sendSignedText(sock, jid, '❌ Failed to load chapter content.', { quoted: message });
        return;
      }

      const content = data.content.length > 4000 ? data.content.slice(0, 3997) + '...' : data.content;
      await sendSignedText(sock, jid, `📖 *${data.title || 'Chapter'}*\n\n${content}`, { quoted: message });
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    await sendSignedText(sock, jid, `Unknown action. Use ${prefix}novel for help.`, { quoted: message });
  } catch (error) {
    logger.error({ error }, 'Novel command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Novel lookup failed. Please try again.', { quoted: message });
  }
}
