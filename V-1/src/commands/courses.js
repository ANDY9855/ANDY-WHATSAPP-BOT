import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function coursesCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  try {
    await reactTo(sock, jid, message.key, '⏳');
    const query = args?.trim();
    const url = query ? `${BASE}/api/courses?q=${encodeURIComponent(query)}` : `${BASE}/api/courses`;
    const data = await fetchJson(url, {}, 20000);

    if (!data.success || data.count === 0) {
      await sendSignedText(sock, jid, query ? `❌ No courses found for *${query}*.` : '❌ No courses found.', {
        quoted: message
      });
      return;
    }

    const courses = data.courses ?? [];
    const shown = courses.length > 15 ? courses.slice(0, 15) : courses;
    const courseLines = shown
      .map((course, index) => `[${index + 1}] ${course.name}\n🔗 ${course.url}`)
      .join('\n\n');
    const note = courses.length > 15 ? `\n\nShowing first 15. Use ${prefix}courses <keyword> to search.` : '';

    await sendSignedText(
      sock,
      jid,
      `🎓 *Free Premium Courses*
📚 Showing ${shown.length} of ${data.total ?? courses.length} courses

${courseLines}${note}

💡 _All courses are free and for educational purposes._
🔍 Search: ${prefix}courses <keyword>`,
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Courses command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Courses lookup failed. Please try again.', { quoted: message });
  }
}
