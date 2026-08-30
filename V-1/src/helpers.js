import { sign } from './signature.js';
import logger from './logger.js';

export async function sendText(sock, jid, text, options = {}) {
  await sock.sendMessage(jid, { text }, options);
}

export async function sendSignedText(sock, jid, text, options = {}) {
  await sendText(sock, jid, sign(text), options);
}

export async function sendImage(sock, jid, buffer, caption, options = {}) {
  await sock.sendMessage(jid, { image: buffer, caption }, options);
}

export async function sendImageWithTextFallback(sock, jid, buffer, caption, fallbackText, options = {}) {
  try {
    await sendImage(sock, jid, buffer, caption, options);
  } catch (error) {
    logger.warn({ error }, 'Image send failed, falling back to text');
    await sendText(sock, jid, fallbackText, options);
  }
}

export async function sendAudio(sock, jid, buffer, caption, options = {}) {
  await sock.sendMessage(
    jid,
    { audio: buffer, mimetype: 'audio/mpeg', ptt: false, caption },
    options
  );
}

export async function sendVideo(sock, jid, buffer, caption, options = {}) {
  await sock.sendMessage(
    jid,
    { video: buffer, mimetype: 'video/mp4', caption },
    options
  );
}

export async function sendDocument(sock, jid, buffer, filename, mimetype, caption, options = {}) {
  await sock.sendMessage(
    jid,
    { document: buffer, fileName: filename, mimetype, caption },
    options
  );
}

export async function reactTo(sock, jid, messageKey, emoji) {
  if (!messageKey) return;

  try {
    await sock.sendMessage(jid, { react: { text: emoji, key: messageKey } });
  } catch (error) {
    logger.debug({ error }, 'Unable to send reaction');
  }
}

export const formatBytesMb = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
};
