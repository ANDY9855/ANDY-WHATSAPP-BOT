import DuckDuckGoService from 'ddgs';
import { SEARCH_MAX_RESULTS, SEARCH_TIMEOUT_MS } from '../config.js';
import { reactTo, sendSignedText } from '../helpers.js';
import logger from '../logger.js';

function formatResult(result, index) {
  const title = result.title || 'Untitled result';
  const url = result.url || result.href || result.pageUrl || '';
  const snippet = result.description || result.snippet || result.body || '';
  const trimmedSnippet = snippet.length > 160 ? `${snippet.slice(0, 157)}...` : snippet;

  return `*${index + 1}.* ${title}\n${url}${trimmedSnippet ? `\n_${trimmedSnippet}_` : ''}`;
}

export async function searchCommand({ sock, jid, args, message, prefix }) {
  const query = args?.trim();

  if (!query) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}search <query>`, { quoted: message });
    return;
  }

  let ddg;

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, '🔍 Searching DuckDuckGo...', { quoted: message });

    ddg = new DuckDuckGoService({
      timeout: SEARCH_TIMEOUT_MS,
      maxRetries: 2,
      region: 'wt-wt',
      safeSearch: true
    });

    const response = await ddg.search(query);
    const results = (response?.results ?? []).slice(0, SEARCH_MAX_RESULTS);

    if (!results.length) {
      await sendSignedText(sock, jid, `❌ No search results found for *${query}*.`, { quoted: message });
      await reactTo(sock, jid, message.key, '✅');
      return;
    }

    const reply = `🔎 *DuckDuckGo Search for:* ${query}\n\n${results
      .map(formatResult)
      .join('\n\n')}`;

    await sendSignedText(sock, jid, reply, { quoted: message });
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error, query }, 'Search command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Search failed. Please try again.', { quoted: message });
  } finally {
    if (ddg) {
      await ddg.close().catch((error) => logger.debug({ error }, 'DuckDuckGo close failed'));
    }
  }
}
