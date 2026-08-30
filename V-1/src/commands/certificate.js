import { fetchBuffer } from '../http.js';
import { reactTo, sendDocument, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const TEMPLATE_NAMES = {
  1: 'Modern',
  2: 'Dark Background',
  3: 'Classic',
  4: 'Elegant',
  5: 'Minimalist',
  6: 'Professional',
  7: 'Corporate',
  8: 'Decorative'
};

function helpText(prefix = BOT_PREFIX) {
  return `📜 *Certificate Generator*

Usage:
${prefix}cert <name> | <date> | <signature> | <details> | <templateId>

Example:
${prefix}cert Ayesha Khan | 18 May 2025 | Dr. Ahmed | For completing Web Dev Bootcamp | 1

*Templates:*
1 - Modern
2 - Dark Background
3 - Classic
4 - Elegant
5 - Minimalist
6 - Professional
7 - Corporate
8 - Decorative`;
}

export async function certCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args || args.trim().toLowerCase() === 'help') {
    await sendSignedText(sock, jid, helpText(prefix), { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    const parts = args.split(' | ').map((part) => part.trim());
    const [name, date, signature, details] = parts;
    let templateId = Number.parseInt(parts[4] || '1', 10);
    if (!Number.isInteger(templateId) || templateId < 1 || templateId > 8) templateId = 1;

    const missing = [
      ['name', name],
      ['date', date],
      ['signature', signature],
      ['details', details]
    ]
      .filter(([, value]) => !value)
      .map(([label]) => label);

    if (missing.length) {
      await sendSignedText(
        sock,
        jid,
        `⚠️ Missing: ${missing.join(', ')}\n\n${helpText(prefix)}`,
        { quoted: message }
      );
      return;
    }

    await sendSignedText(sock, jid, '⏳ Processing your request...', { quoted: message });

    const { buffer, response } = await fetchBuffer(
      `${BASE}/api/certificate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date,
          signature,
          details,
          templateId,
          format: 'pdf',
          returnUrl: false
        })
      },
      30000
    );

    const templateName = response.headers.get('x-template-name') || TEMPLATE_NAMES[templateId] || 'Template';
    const filename = response.headers.get('x-file-name') || `Certificate_${name.replace(/\s+/g, '_')}.pdf`;

    await sendDocument(
      sock,
      jid,
      buffer,
      filename,
      'application/pdf',
      signCaption(`📜 *Certificate Generated!*\n👤 Name: ${name}\n📅 Date: ${date}\n✍️ Signed by: ${signature}\n🎨 Template: ${templateName}`),
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'Certificate command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Certificate generation failed. Please try again.', { quoted: message });
  }
}
