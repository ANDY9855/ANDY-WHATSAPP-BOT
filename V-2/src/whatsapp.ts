import makeWASocket, {
  Browsers, DisconnectReason, downloadContentFromMessage, extractMessageContent,
  jidNormalizedUser, makeCacheableSignalKeyStore, useMultiFileAuthState, proto
} from '@whiskeysockets/baileys'
import P from 'pino'
import qrcode from 'qrcode-terminal'
import path from 'node:path'
import fs from 'node:fs/promises'
import { MessageRepository, StoredMessage, ensureMediaDir, writeMedia } from './db.js'
import { downloader, isValidHttpUrl, screenshot, tts } from './api.js'
import { helpText, isOwnerJid, parseCommand } from './commands.js'
import { handleApiCommand } from './api-commands.js'
import { allowCommand, logEvent } from './ops.js'
import { answerQuiz, beginQuiz, hasQuiz, parseOption } from './quiz.js'
import { formatApiResult } from './format.js'
import { sendHackPrank } from './hack.js'

const ownerNumber = (process.env.OWNER_NUMBER ?? '923000000000').replace(/\D/g, '')
const prefix = process.env.PREFIX ?? '.'
const mediaDir = process.env.MEDIA_DIR ?? './data/media'

function unwrapMessage(message: any): any {
  let current = message
  for (let i = 0; i < 8 && current; i++) {
    if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message
    else if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message
    else if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message
    else if (current.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message
    else break
  }
  return current
}

function quotedMessage(m: any): any | null {
  const context = m.message?.extendedTextMessage?.contextInfo ?? m.message?.imageMessage?.contextInfo ?? m.message?.videoMessage?.contextInfo
  return context?.quotedMessage ?? null
}

function messageText(m: any) {
  const content = unwrapMessage(m.message)
  return content?.conversation ?? content?.extendedTextMessage?.text ?? content?.imageMessage?.caption ?? content?.videoMessage?.caption ?? content?.documentMessage?.caption ?? ''
}

function mediaInfo(content: any) {
  if (content?.imageMessage) return { type: 'image', payload: content.imageMessage, mime: content.imageMessage.mimetype, ext: 'jpg', caption: content.imageMessage.caption }
  if (content?.videoMessage) return { type: 'video', payload: content.videoMessage, mime: content.videoMessage.mimetype, ext: 'mp4', caption: content.videoMessage.caption }
  if (content?.audioMessage) return { type: 'audio', payload: content.audioMessage, mime: content.audioMessage.mimetype, ext: 'ogg', caption: undefined }
  if (content?.documentMessage) return { type: 'document', payload: content.documentMessage, mime: content.documentMessage.mimetype, ext: path.extname(content.documentMessage.fileName ?? '').slice(1) || 'bin', caption: content.documentMessage.caption }
  return null
}

async function downloadMedia(payload: any, type: string) {
  const stream = await downloadContentFromMessage(payload, type as any)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function isRetriableSendError(error: any) {
  const code = error?.output?.statusCode ?? error?.data?.statusCode
  if (code === 428 || code === 503 || code === 504 || code === 429) return true
  return /connection closed|timed out|precondition required/i.test(String(error?.message ?? ''))
}

async function sendWithRetry(sock: any, jid: string, content: any, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await sock.sendMessage(jid, content)
    } catch (error) {
      if (attempt >= attempts || !isRetriableSendError(error)) throw error
      await new Promise(resolve => setTimeout(resolve, attempt * 2000))
    }
  }
}

async function saveIncoming(repo: MessageRepository, m: any): Promise<StoredMessage> {
  const content = unwrapMessage(m.message) ?? {}
  const info = mediaInfo(content)
  let mediaPath: string | undefined
  if (info) {
    try {
      const bytes = await downloadMedia(info.payload, info.type)
      mediaPath = await writeMedia(mediaDir, m.key.id, info.ext, bytes)
    } catch (error) {
      console.error('media capture failed', error)
    }
  }
  const stored: StoredMessage = {
    messageId: m.key.id,
    chatJid: m.key.remoteJid,
    senderJid: m.key.participant ?? m.key.remoteJid,
    participantJid: m.key.participant,
    messageType: info?.type ?? (content.protocolMessage ? 'protocol' : 'text'),
    textBody: messageText(m),
    caption: info?.caption,
    quotedMessageId: m.message?.extendedTextMessage?.contextInfo?.stanzaId,
    rawMessage: m.message,
    mediaPath,
    mediaMimetype: info?.mime,
    mediaFilename: content.documentMessage?.fileName
  }
  await repo.saveMessage(stored)
  return stored
}

async function forwardRevoked(sock: any, repo: MessageRepository, revoke: any) {
  const id = revoke.key?.id
  if (!id) return
  const previous = await repo.findMessage(id)
  await repo.markRevoked(id)
  if (!previous) return
  const header = `⚠️ *Deleted message recovered*\nChat: ${previous.chatJid}\nSender: ${previous.senderJid}\nOriginal ID: ${id}`
  await sendWithRetry(sock,`${ownerNumber}@s.whatsapp.net`, { text: header })
  if (previous.mediaPath && previous.mediaMimetype) {
    const bytes = await fs.readFile(previous.mediaPath)
    const type = previous.messageType
    const payload = type === 'image' ? { image: bytes } : type === 'video' ? { video: bytes } : type === 'audio' ? { audio: bytes, ptt: false } : { document: bytes, fileName: previous.mediaFilename ?? 'recovered-file' }
    await sendWithRetry(sock,`${ownerNumber}@s.whatsapp.net`, { ...payload, mimetype: previous.mediaMimetype, caption: previous.caption ?? 'Recovered attachment' })
  } else if (previous.textBody) {
    await sendWithRetry(sock,`${ownerNumber}@s.whatsapp.net`, { text: `Deleted text:\n${previous.textBody}` })
  }
}

async function sendViewOnce(sock: any, jid: string, quoted: any) {
  const content = unwrapMessage(quoted)
  const info = mediaInfo(content)
  if (!info) {
    const text = messageText({ message: quoted })
    return sock.sendMessage(jid, { text: text ? `Quoted message:\n${text}` : 'The quoted message is not a supported view-once media message.' })
  }
  const bytes = await downloadMedia(info.payload, info.type)
  if (info.type === 'image') return sock.sendMessage(jid, { image: bytes, mimetype: info.mime, caption: info.caption ?? 'View-once media recovered' })
  if (info.type === 'video') return sock.sendMessage(jid, { video: bytes, mimetype: info.mime, caption: info.caption ?? 'View-once media recovered' })
  if (info.type === 'audio') return sock.sendMessage(jid, { audio: bytes, mimetype: info.mime, ptt: false })
  return sock.sendMessage(jid, { document: bytes, mimetype: info.mime, fileName: content.documentMessage?.fileName ?? 'recovered-file' })
}

export async function startBot(repo = new MessageRepository()) {
  await ensureMediaDir(mediaDir)
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })) }, browser: Browsers.macOS('Chrome'), logger: P({ level: 'silent' }), markOnlineOnConnect: false })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }: any) => {
    if (qr) qrcode.generate(qr, { small: true })
    if (connection === 'open') console.log('WhatsApp connected; anti-delete is active')
    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) setTimeout(() => void startBot(repo), 3000)
      else console.error('Logged out; remove auth_info and pair again')
    }
  })
  const seenMessageIds = new Set<string>()
  const rememberSeen = (id: string) => {
    seenMessageIds.add(id)
    if (seenMessageIds.size > 5000) {
      const oldest = seenMessageIds.values().next().value
      if (oldest) seenMessageIds.delete(oldest)
    }
  }
  const handleMessages = async (messages: any[], type = 'notify') => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (!m.message || !m.key.id) continue
      const content = unwrapMessage(m.message)
      const isRevoke = content?.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE
      if (!isRevoke && seenMessageIds.has(m.key.id)) continue
      rememberSeen(m.key.id)
      try {
        if (isRevoke) {
          await forwardRevoked(sock, repo, content.protocolMessage)
          continue
        }
        await saveIncoming(repo, m)
        const text = messageText(m)
        const jid = m.key.remoteJid
        const option = parseOption(text)
        if (hasQuiz(jid) && option !== null) {
          if (!allowCommand(jid)) { await sendWithRetry(sock, jid, { text: '*🤖 BOT_404 — QUIZ*\\n\\nRate limit reached. Try again shortly.' }); continue }
          const result = answerQuiz(jid, option)
          if (result.kind === 'next') await sendWithRetry(sock, jid, { text: result.text })
          else if (result.kind === 'complete') await sendWithRetry(sock, jid, { text: result.text })
          continue
        }
        const command = parseCommand(text, prefix)
        if (!command) continue
        if (!allowCommand(jid)) { logEvent('rate_limited', { jid, command: command.name }); await sendWithRetry(sock,jid, { text: '*🤖 BOT_404 — RATE LIMIT*\\n\\nTry again shortly.' }); continue }
        logEvent('command_received', { jid, command: command.name })
        const owner = m.key.fromMe || isOwnerJid(m.key.participant ?? jid, ownerNumber)
        if (command.name === 'help' || command.name === 'menu') await sendWithRetry(sock,jid, { text: helpText(prefix) })
        else if (command.name === 'quiz') {
          const remote = await (await import('./api.js')).telenorQuiz()
          await sendWithRetry(sock, jid, { text: beginQuiz(jid, remote) })
        }
        else if (command.name === 'hack') {
          const quoted = quotedMessage(m)
          if (!quoted) await sendWithRetry(sock, jid, { text: `*🤖 BOT_404 — HACK PRANK*\\n\\n*Usage:* reply to a message with ${prefix}hack.` })
          else await sendHackPrank(text => sendWithRetry(sock, jid, { text }))
        } else if (command.name === 'vv') {
          const quoted = quotedMessage(m)
          if (!quoted) await sendWithRetry(sock,jid, { text: `Reply to a view-once image, video, audio, or document with ${prefix}vv.` })
          else await sendViewOnce(sock, jid, quoted)
        } else if (command.name === 'antidelete') {
          if (!owner) await sendWithRetry(sock,jid, { text: '*🤖 BOT_404 — ACCESS DENIED*\\n\\nOwner-only command.' })
          else await sendWithRetry(sock,jid, { text: 'Anti-delete is always active in this build.' })
        } else if (command.name === 'tts') {
          if (!command.args.length) await sendWithRetry(sock,jid, { text: `Usage: ${prefix}tts <text>` })
          else { const voiceIndex = /^\\d+$/.test(command.args.at(-1) ?? '') ? Number(command.args.pop()) : 1; const audio = await tts(command.args.join(' '), voiceIndex); await sendWithRetry(sock,jid, { audio: audio.data, mimetype: 'audio/mpeg', ptt: false }) }
        } else if (command.name === 'dl') {
          if (!command.args[0] || !isValidHttpUrl(command.args[0])) await sendWithRetry(sock,jid, { text: `Usage: ${prefix}dl https://example.com/video` })
          else await sendWithRetry(sock,jid, { text: formatApiResult(await downloader(command.args[0]), 'DOWNLOAD') })
        }         else if (command.name === 'screenshot') {
          if (!command.args[0] || !isValidHttpUrl(command.args[0])) await sendWithRetry(sock,jid, { text: `Usage: ${prefix}screenshot https://example.com` })
          else { const image = await screenshot(command.args[0]); await sendWithRetry(sock,jid, { image: image.data, mimetype: image.contentType }) }
        } else {
          await handleApiCommand(sock, jid, command)
        }
      } catch (error) {
        console.error('message handler failed', error)
        await sendWithRetry(sock,m.key.remoteJid, { text: '*🤖 BOT_404 — ERROR*\\n\\nSomething went wrong. Please try again.' }).catch(() => undefined)
      }
    }
  }
  sock.ev.on('messages.upsert', async ({ messages, type }: any) => { await handleMessages(messages, type) })
  sock.ev.on('messages.update', async (updates: any[]) => {
    const revoked = updates.map((u: any) => ({ ...u, message: u.update?.message ?? u.message, key: u.key }))
    await handleMessages(revoked, 'notify')
  })
  return sock
}
