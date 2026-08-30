import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const sectionEmoji = {
  uses: '📌',
  dosage: '📏',
  side_effects: '⚠️',
  interactions: '🔗',
  contraindications: '🚫',
  storage: '📦',
  warnings: '⚠️'
};

export async function medicineCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}med <medicine name>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, '⏳ Processing your request...', { quoted: message });

    const search = await fetchJson(`${BASE}/api/search?q=${encodeURIComponent(args)}`, {}, 20000);
    if (!search.success || !search.count || !search.results?.length) {
      await sendSignedText(sock, jid, `❌ No medicine found for *${args}*. Try a different name.`, {
        quoted: message
      });
      return;
    }

    const first = search.results[0];
    const details = await fetchJson(`${BASE}/api/details?id=${encodeURIComponent(first.id)}`, {}, 20000);
    const medicine = details.medicine;
    const sections = (medicine.details ?? [])
      .filter((section) => section?.content)
      .map((section) => {
        const emoji = sectionEmoji[section.section] || '📋';
        const title = section.title || section.section || 'Details';
        return `━━━━━━━━━━━━━━━━━━━━\n${emoji} *${title.toUpperCase()}*\n${section.content}`;
      });

    const response = `💊 *${medicine.name}*
💰 Price: ${medicine.price || first.price || 'N/A'}
🏷️ Discount: ${medicine.discount || 'N/A'}

${sections.join('\n\n')}`;

    await sendSignedText(sock, jid, response, { quoted: message });
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Medicine command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Medicine lookup failed. Please try again.', { quoted: message });
  }
}
