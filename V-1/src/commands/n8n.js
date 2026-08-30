import { fetchJson } from '../http.js';
import { reactTo, sendSignedText } from '../helpers.js';
import { BOT_PREFIX } from '../config.js';
import logger from '../logger.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

const COMPLEXITY = ['Simple', 'Medium', 'Complex'];
const TRIGGER_TYPES = ['Manual', 'Scheduled', 'Triggered', 'Webhook'];

export async function n8nCommand({ sock, jid, args, message, prefix = BOT_PREFIX }) {
  if (!args) {
    await sendSignedText(sock, jid,
      `⚡ *n8n Workflow Explorer*

Usage:
${prefix}n8n [category] [complexity] [triggerType]

Filters (optional):
- category: e.g. ai-automation, woocommerce
- complexity: Simple, Medium, Complex
- triggerType: Manual, Scheduled, Triggered, Webhook

Example:
${prefix}n8n ai-automation Complex
${prefix}n8n woocommerce Simple Webhook

Tip: Use ${prefix}n8n to see all.`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    const parts = args.trim().split(/\s+/).filter(Boolean);
    let category = '';
    let complexity = '';
    let triggerType = '';

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (COMPLEXITY.map((c) => c.toLowerCase()).includes(lower)) {
        complexity = COMPLEXITY.find((c) => c.toLowerCase() === lower) || part;
      } else if (TRIGGER_TYPES.map((t) => t.toLowerCase()).includes(lower)) {
        triggerType = TRIGGER_TYPES.find((t) => t.toLowerCase() === lower) || part;
      } else {
        category = part;
      }
    }

    let url = `${BASE}/api/n8n?endpoint=templates`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (complexity) url += `&complexity=${encodeURIComponent(complexity)}`;
    if (triggerType) url += `&triggerType=${encodeURIComponent(triggerType)}`;

    const data = await fetchJson(url, {}, 20000);

    if (!data.templates?.length) {
      await sendSignedText(sock, jid, '❌ No workflows found matching your filters.', { quoted: message });
      return;
    }

    const lines = data.templates.slice(0, 10).map((t, i) =>
      `[${i + 1}] *${t.name}*\n${t.description || ''}\nComplexity: ${t.complexity || 'N/A'} | Trigger: ${t.triggerType || 'N/A'} | Nodes: ${t.nodeCount || '?'}`
    );

    const pagination = data.pagination
      ? `\nPage ${data.pagination.currentPage || 1} of ${data.pagination.totalPages || '?'}`
      : '';

    await sendSignedText(sock, jid,
      `⚡ *n8n Workflows*${pagination}\n\n${lines.join('\n\n')}\n\nUse ${prefix}n8n <category> [complexity] [triggerType] to filter.`,
      { quoted: message }
    );
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'n8n command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ n8n workflow lookup failed. Please try again.', { quoted: message });
  }
}
