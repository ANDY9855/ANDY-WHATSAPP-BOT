import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestWaWebVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { HEALTH_LOG_PATH, OWNER_JID, SESSION_DIR } from './config.js';
import logger from './logger.js';
import { queue } from './queue.js';
import { handleMessage } from './router.js';

const msgCache = new Map()
const MSG_CACHE_TTL = 30 * 60 * 1000 // 30 min

const RECONNECT_DELAYS = [5000, 10000, 20000, 40000, 60000];

let reconnectAttempt = 0;
let healthTimer = null;
let bannerShown = false;
let connectionState = 'starting';

export let sock = null;

function printBanner() {
  if (bannerShown) return;
  bannerShown = true;
  logger.info(`
  ____            _   _        _         _                        _   _
 / ___|  __ _ ___| |_(_)      / \\  _   _| |_ ___  _ __ ___   __ _| |_(_) ___  _ __
 \\___ \\ / _\` / __| __| |____ / _ \\| | | | __/ _ \\| '_ \` _ \\ / _\` | __| |/ _ \\| '_ \\
  ___) | (_| \\__ \\ |_| |____/ ___ \\ |_| | || (_) | | | | | | (_| | |_| | (_) | | | |
 |____/ \\__,_|___/\\__|_|   /_/   \\_\\__,_|\\__\\___/|_| |_| |_|\\__,_|\\__|_|\\___/|_| |_|
`);
}

function startHealthLogging() {
  if (healthTimer) return;

  healthTimer = setInterval(async () => {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      connectionState,
      queueSize: queue.size,
      pendingTasks: queue.pending
    });

    try {
      await fs.mkdir(HEALTH_LOG_PATH.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
      await fs.appendFile(HEALTH_LOG_PATH, `${line}\n`);
    } catch (error) {
      logger.debug({ error }, 'Unable to write health log');
    }

    logger.info({ connectionState, queueSize: queue.size, pendingTasks: queue.pending }, 'Health check');
  }, 5 * 60 * 1000);
}

function shouldSkipMessage(message) {
  const jid = message.key?.remoteJid;
  if (!jid) return true;
  if (jid === 'status@broadcast') return true;
  if (jid.endsWith('@broadcast')) return true;
  return false;
}

export function getConnectionState() {
  return connectionState;
}

const RECONNECT_FAILURE_WINDOW_MS = 30000;
const MAX_FAST_FAILURES = 3;

let fastReconnectFailures = 0;
let lastReconnectTime = 0;

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  const { version } = await fetchLatestWaWebVersion();
  logger.info({ version }, 'Using WhatsApp Web version');

  const socketOptions = {
    version,
    auth: state,
    browser: Browsers.windows('Chrome', '120'),
    logger: pino({ level: 'silent' }),
    getMessage: async (key) => msgCache.get(key.id) || { conversation: '' },
    fireAndForget: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 3
  };

  sock = makeWASocket(socketOptions);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (connection) connectionState = connection;

    if (qr) {
      logger.info('Scan this QR code from WhatsApp > Linked devices > Link a device');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      reconnectAttempt = 0;
      printBanner();
      startHealthLogging();
      logger.info('✅ BOT_404 connected');
      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reasonName = Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ?? statusCode;
      logger.warn(
        { statusCode, reasonName, connectedAt: lastDisconnect?.error?.output?.connectedAt },
        'Connection closed'
      );

      // Detect rapid reconnect loops — session keeps getting killed immediately
      const now = Date.now();
      if (now - lastReconnectTime < RECONNECT_FAILURE_WINDOW_MS) {
        fastReconnectFailures++;
      } else {
        fastReconnectFailures = 0;
      }
      lastReconnectTime = now;

      if (fastReconnectFailures >= MAX_FAST_FAILURES) {
        logger.fatal(
          { fastReconnectFailures },
          'Session rejected repeatedly. Auth state is stale. Deleting auth folder — re-scan QR on next start.'
        );
        await rm(SESSION_DIR, { recursive: true, force: true }).catch(() => {});
        process.exit(1);
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && reconnectAttempt < RECONNECT_DELAYS.length) {
        const delay = RECONNECT_DELAYS[reconnectAttempt];
        reconnectAttempt += 1;
        logger.warn(
          { attempt: reconnectAttempt, delayMs: delay },
          `Reconnecting in ${delay / 1000}s`
        );
        setTimeout(() => {
          startBot().catch((error) => logger.error({ error }, 'Reconnect failed'));
        }, delay);
        return;
      }

      if (!shouldReconnect) {
        logger.fatal('🔴 Logged out. Auth folder will need to be removed and QR re-scanned on restart.');
      } else {
        logger.fatal('🔴 Max reconnection attempts reached. Exiting.');
      }
      process.exit(1);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // ─── Message cache (for anti-delete + protocol) ─────────
      if (msg.message) {
        msgCache.set(msg.key.id, msg)
        setTimeout(() => msgCache.delete(msg.key.id), MSG_CACHE_TTL)
      }

      // ─── View Once Handler (best-effort auto-detect) ─────
      const viewOnceWrapper =
        msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessageV2Extension?.message

      if (viewOnceWrapper || msg.key?.isViewOnce) {
        if (!msg.message) continue

        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger, reuploadRequest: sock.updateMediaMessage }
          )

          const inner = viewOnceWrapper || msg.message
          const isVideo = !!(inner?.videoMessage)
          const caption = inner?.imageMessage?.caption ||
                          inner?.videoMessage?.caption || ''
          const sender = msg.key.remoteJid

          await sock.sendMessage(OWNER_JID, {
            [isVideo ? 'video' : 'image']: buffer,
            caption: `👁 *View Once*\nFrom: ${sender}\n${caption}`
          })
        } catch (err) {
          logger.error({ err }, 'ViewOnce auto handler failed')
        }

        continue
      }

      // ─── Skip normal route if it was view-once only ─────────
      if (shouldSkipMessage(msg)) continue;

      try {
        if (!msg.key?.fromMe) {
          await sock.readMessages([msg.key]);
        }
        await handleMessage(sock, msg);
      } catch (error) {
        logger.error({ error }, 'Message processing failed');
      }
    }
  });

  // ─── Anti-Delete Handler ────────────────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (update.update.message !== null) continue;

      const cached = msgCache.get(update.key.id)
      if (!cached) continue

      try {
        const sender = cached.key.remoteJid
        const text =
          cached.message?.conversation ||
          cached.message?.extendedTextMessage?.text ||
          ''

        const hasMedia =
          cached.message?.imageMessage ||
          cached.message?.videoMessage ||
          cached.message?.audioMessage ||
          cached.message?.documentMessage

        await sock.sendMessage(OWNER_JID, {
          text: `🗑 *Anti-Delete*\nFrom: ${sender}\n\n${text || '_(media message)_'}`
        })

        if (hasMedia) {
          const buffer = await downloadMediaMessage(cached, 'buffer', {}, {
            logger,
            reuploadRequest: sock.updateMediaMessage
          })

          const type = cached.message?.imageMessage ? 'image'
            : cached.message?.videoMessage ? 'video'
            : cached.message?.audioMessage ? 'audio'
            : 'document'

          await sock.sendMessage(OWNER_JID, {
            [type]: buffer
          })
        }
      } catch (err) {
        logger.error({ err }, 'AntiDelete handler failed')
      }
    }
  })

  return sock;
}
