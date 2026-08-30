import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function mailCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid, `📧 *Disposable Email*

Usage:
${prefix}mail create [name] - Generate a new email
${prefix}mail inbox <email> - Check inbox
${prefix}mail read <email> <id> - Read a message
${prefix}mail delete <email> <id> - Delete a message

Example:
${prefix}mail create
${prefix}mail inbox temp123@example.com`, { quoted: message });
    return;
  }

  try {
    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();

    if (action === 'create') {
      await reactTo(sock, jid, message.key, '⏳');
      const name = parts[1] || '';
      const url = name ? `${BASE}/api/mail?action=create&name=${encodeURIComponent(name)}` : `${BASE}/api/mail?action=create`;
      const data = await fetchJson(url, {}, 15000);

      if (!data.success) {
        await sendSignedText(sock, jid, '❌ Failed to create email address.', { quoted: message });
        return;
      }

      await sendSignedText(sock, jid,
        `📧 *Disposable Email Created!*\n📬 Address: \`${data.address}\`\n\nUse ${prefix}mail inbox ${data.address} to check messages.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'inbox') {
      const mail = parts[1];
      if (!mail) {
        await sendSignedText(sock, jid, `Usage: ${prefix}mail inbox <email>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/mail?action=inbox&mail=${encodeURIComponent(mail)}`, {}, 15000);

      if (!data.success || !data.messages?.length) {
        await sendSignedText(sock, jid, `📭 Inbox for ${mail} is empty.`, { quoted: message });
        await reactTo(sock, jid, message.key, '✅');
        return;
      }

      const lines = data.messages.slice(0, 10).map((msg, i) =>
        `[${i + 1}] *${msg.subject || '(No subject)'}*\nFrom: ${msg.from}\nID: ${msg.id}`
      );

      await sendSignedText(sock, jid,
        `📬 *Inbox: ${mail}*\nShowing ${Math.min(data.messages.length, 10)} of ${data.messages.length}\n\n${lines.join('\n\n')}\n\nUse ${prefix}mail read <email> <id> to read.`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'read') {
      const mail = parts[1];
      const id = parts[2];
      if (!mail || !id) {
        await sendSignedText(sock, jid, `Usage: ${prefix}mail read <email> <messageId>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/mail?action=read&mail=${encodeURIComponent(mail)}&id=${encodeURIComponent(id)}`, {}, 15000);

      if (!data.success || !data.message) {
        await sendSignedText(sock, jid, '❌ Message not found.', { quoted: message });
        return;
      }

      const msg = data.message;
      await sendSignedText(sock, jid,
        `📧 *Message*\nFrom: ${msg.from || 'Unknown'}\nSubject: ${msg.subject || '(No subject)'}\nDate: ${msg.date || 'N/A'}\n\n${msg.body || '(No content)'}`,
        { quoted: message }
      );
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    if (action === 'delete') {
      const mail = parts[1];
      const id = parts[2];
      if (!mail || !id) {
        await sendSignedText(sock, jid, `Usage: ${prefix}mail delete <email> <messageId>`, { quoted: message });
        return;
      }

      await reactTo(sock, jid, message.key, '⏳');
      const data = await fetchJson(`${BASE}/api/mail?action=delete&mail=${encodeURIComponent(mail)}&id=${encodeURIComponent(id)}`, {}, 15000);

      if (data.success) {
        await sendSignedText(sock, jid, '✅ Message deleted.', { quoted: message });
      } else {
        await sendSignedText(sock, jid, '❌ Failed to delete message.', { quoted: message });
      }
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    await sendSignedText(sock, jid, `Unknown action. Use ${prefix}mail for help.`, { quoted: message });
  } catch (error) {
    logger.error({ error }, 'Mail command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Email service failed. Please try again.', { quoted: message });
  }
}
