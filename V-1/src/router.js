import { BOT_PREFIX, SELF_PREFIX } from './config.js';
import { sendSignedText } from './helpers.js';
import logger from './logger.js';
import { queue } from './queue.js';
import { sign } from './signature.js';
import { aibotCommand } from './commands/ai.js';
import { alldlCommand } from './commands/alldl.js';
import { certCommand } from './commands/certificate.js';
import { coursesCommand } from './commands/courses.js';
import { audioDownloadCommand, downloadCommand } from './commands/download.js';
import { imageCommand, imageToImageCommand } from './commands/image.js';
import { mailCommand } from './commands/mail.js';
import { mangaCommand } from './commands/manga.js';
import { medicineCommand } from './commands/medicine.js';
import { menuCommand } from './commands/menu.js';
import { movieCommand } from './commands/movie.js';
import { n8nCommand } from './commands/n8n.js';
import { novelCommand } from './commands/novel.js';
import { searchCommand } from './commands/search.js';
import { ttsCommand, voicesCommand } from './commands/speech.js';
import { unovelCommand } from './commands/unovel.js';
import { visionCommand } from './commands/vision.js';
import { vvCommand } from './commands/vv.js';
import { websnapCommand } from './commands/websnap.js';
import { webzipCommand } from './commands/webzip.js';
import { wikipdfCommand } from './commands/wikipdf.js';

const handlers = new Map([
  ['menu', menuCommand],
  ['aibot', aibotCommand],
  ['tts', ttsCommand],
  ['voices', voicesCommand],
  ['med', medicineCommand],
  ['img', imageCommand],
  ['i2i', imageToImageCommand],
  ['pti', imageToImageCommand],
  ['screenshot', websnapCommand],
  ['ss', websnapCommand],
  ['zip', webzipCommand],
  ['wikipdf', wikipdfCommand],
  ['wiki', wikipdfCommand],
  ['cert', certCommand],
  ['courses', coursesCommand],
  ['movie', movieCommand],
  ['dl', downloadCommand],
  ['audio', audioDownloadCommand],
  ['alldl', alldlCommand],
  ['vision', visionCommand],
  ['vv', vvCommand],
  ['mail', mailCommand],
  ['manga', mangaCommand],
  ['novel', novelCommand],
  ['unovel', unovelCommand],
  ['n8n', n8nCommand],
  ['search', searchCommand],
  ['ping', async ({ sock, jid, message }) => sendSignedText(sock, jid, '🏓 Pong! Bot is alive.', { quoted: message })]
]);

const spamState = new Map();
const SPAM_WINDOW_MS = 10000;
const SPAM_LIMIT = 5;
const BLOCK_MS = 30000;

function extractText(message) {
  const content = message.message;
  return (
    content?.conversation ??
    content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ??
    content?.videoMessage?.caption ??
    null
  );
}

function splitCommand(text) {
  const trimmed = text.trim();
  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) {
    return { commandPart: trimmed.toLowerCase(), argsPart: '' };
  }

  return {
    commandPart: trimmed.slice(0, firstSpace).toLowerCase(),
    argsPart: trimmed.slice(firstSpace + 1).trim()
  };
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
}

function suggestCommand(commandPart, usedPrefix) {
  const commandName = commandPart.startsWith(usedPrefix)
    ? commandPart.slice(usedPrefix.length)
    : commandPart;
  let best = null;
  for (const command of handlers.keys()) {
    const distance = levenshtein(commandName, command);
    if (!best || distance < best.distance) {
      best = { command, distance };
    }
  }
  return best && best.distance <= 2 ? `${usedPrefix}${best.command}` : null;
}

async function checkSpam(sock, jid, sender, message) {
  const now = Date.now();
  const state = spamState.get(sender) ?? {
    timestamps: [],
    blockedUntil: 0,
    warnedForBlock: false
  };

  if (state.blockedUntil > now) {
    spamState.set(sender, state);
    return true;
  }

  state.timestamps = state.timestamps.filter((timestamp) => now - timestamp <= SPAM_WINDOW_MS);
  state.timestamps.push(now);

  if (state.timestamps.length > SPAM_LIMIT) {
    state.blockedUntil = now + BLOCK_MS;
    state.warnedForBlock = true;
    state.timestamps = [];
    spamState.set(sender, state);
    await sendSignedText(
      sock,
      jid,
      '⚠️ Too many commands too quickly. Please wait 30 seconds before trying again.',
      { quoted: message }
    );
    return true;
  }

  state.warnedForBlock = false;
  spamState.set(sender, state);
  return false;
}

export async function handleMessage(sock, message) {
  const rawText = extractText(message);
  if (!rawText || !rawText.trim()) return;

  const text = rawText.trim();
  const isSelf = message.key?.fromMe === true;
  const usedPrefix = isSelf
    ? (text.startsWith(SELF_PREFIX) ? SELF_PREFIX : null)
    : (text.startsWith(BOT_PREFIX) ? BOT_PREFIX : null);

  if (!usedPrefix) return;

  const jid = message.key.remoteJid;
  const sender = message.key.participant || message.key.remoteJid;
  if (!isSelf && await checkSpam(sock, jid, sender, message)) return;

  const { commandPart, argsPart } = splitCommand(text);
  const commandName = commandPart.slice(usedPrefix.length);
  const handler = handlers.get(commandName);

  if (!handler) {
    const suggestion = suggestCommand(commandPart, usedPrefix);
    const messageText = suggestion
      ? `❓ Unknown command. Did you mean ${suggestion}?\nType ${usedPrefix}menu to see all commands.`
      : `❓ Unknown command. Type ${usedPrefix}menu to see all commands.`;
    await sendSignedText(sock, jid, messageText, { quoted: message });
    return;
  }

  const ctx = {
    sock,
    jid,
    message,
    sender,
    args: argsPart,
    prefix: usedPrefix,
    isSelf,
    isGroup: jid?.endsWith('@g.us') ?? false,
    quotedMsg: message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null
  };

  queue.add(async () => {
    try {
      await handler(ctx);
    } catch (error) {
      logger.error({ command: commandPart, error }, 'Unhandled command error');
      await sendSignedText(sock, jid, '❌ Something went wrong while processing your request. Please try again.', {
        quoted: message
      });
    }
  }).catch((error) => {
    logger.error({ command: commandPart, error }, 'Failed to enqueue command');
  });
}

export const commandList = [...handlers.keys()];
export const signText = sign;
