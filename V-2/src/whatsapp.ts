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
import { helpText, isOwnerJid, parseCommand, parseVoiceIndexAndText, parseSendVoiceArgs } from './commands.js'
import { handleApiCommand } from './api-commands.js'
import { allowCommand, logEvent } from './ops.js'
import { answerQuiz, beginQuiz, hasQuiz, parseOption } from './quiz.js'
import { formatApiResult } from './format.js'
import { sendHackPrank } from './hack.js'
import { cancelPendingAutoReply, scheduleAutoReply, isAutoReplyEnabled, setAutoReplyEnabled, isBotMessageId, transcribeAudioWithGemini } from './auto-reply.js'
import { notifyAndyIfImportant } from './importance.js'

const ownerNumber = (process.env.OWNER_NUMBER ?? '923333425155').replace(/\D/g, '')
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

function isStatusJid(jid?: string): boolean {
  if (!jid) return false
  return jid === 'status@broadcast' || jid.endsWith('@status.whatsapp.net')
}

async function saveIncoming(repo: MessageRepository, m: any): Promise<StoredMessage | null> {
  const chatJid = m.key?.remoteJid
  if (isStatusJid(chatJid)) {
    // Skip storing status updates (stories) to save disk storage
    return null
  }
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
  if (isStatusJid(revoke.key?.remoteJid)) {
    console.log(`[AntiDelete] Ignored deleted WhatsApp status update (ID: ${id})`)
    return
  }
  const previous = await repo.findMessage(id)
  await repo.markRevoked(id)
  if (!previous) return
  if (isStatusJid(previous.chatJid) || isStatusJid(previous.senderJid)) {
    console.log(`[AntiDelete] Ignored deleted WhatsApp status update (ID: ${id})`)
    return
  }
  const header = `⚠️ *Deleted message recovered*\nChat: ${previous.chatJid}\nSender: ${previous.senderJid}\nOriginal ID: ${id}`
  await sendWithRetry(sock, `${ownerNumber}@s.whatsapp.net`, { text: header })
  if (previous.mediaPath && previous.mediaMimetype) {
    const bytes = await fs.readFile(previous.mediaPath)
    const type = previous.messageType
    const payload = type === 'image' ? { image: bytes } : type === 'video' ? { video: bytes } : type === 'audio' ? { audio: bytes, ptt: false } : { document: bytes, fileName: previous.mediaFilename ?? 'recovered-file' }
    await sendWithRetry(sock, `${ownerNumber}@s.whatsapp.net`, { ...payload, mimetype: previous.mediaMimetype, caption: previous.caption ?? 'Recovered attachment' })
  } else if (previous.textBody) {
    await sendWithRetry(sock, `${ownerNumber}@s.whatsapp.net`, { text: `Deleted text:\n${previous.textBody}` })
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
    if (connection === 'open') console.log("Andy's Bot connected; anti-delete is active")
    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) setTimeout(() => void startBot(repo), 3000)
      else console.error('Logged out; remove auth_info and pair again')
    }
  })

  // Listen for read receipts specifically for INCOMING messages (fromMe === false)
  sock.ev.on('message-receipt.update', (receipts: any[]) => {
    for (const r of receipts) {
      if (r.key?.remoteJid && r.key?.fromMe === false) {
        console.log(`[ReadReceipt Event] Incoming message read receipt for ${r.key.remoteJid} (msgId: ${r.key.id})`)
        cancelPendingAutoReply(r.key.remoteJid, `Incoming message read receipt received via message-receipt.update (msgId: ${r.key.id})`)
      }
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
        const owner = m.key.fromMe || isOwnerJid(m.key.participant ?? jid, ownerNumber)

        // Cancel pending auto-reply ONLY if Andy manually sends a message from his client (not bot auto-reply)
        if (m.key.fromMe && jid) {
          if (isBotMessageId(m.key.id)) {
            console.log(`[WhatsApp Handler] Outgoing message ${m.key.id} was generated by Andy's Bot auto-reply. Preserving state.`)
          } else {
            console.log(`[WhatsApp Handler] Outgoing message ${m.key.id} sent manually by Andy on his phone. Canceling auto-reply timer for ${jid}.`)
            cancelPendingAutoReply(jid, 'Andy manually sent a message from his device')
          }
        }

        const option = parseOption(text)
        if (hasQuiz(jid) && option !== null) {
          if (!allowCommand(jid)) { await sendWithRetry(sock, jid, { text: "*🤖 Andy's Bot — QUIZ*\n\nRate limit reached. Try again shortly." }); continue }
          const result = answerQuiz(jid, option)
          if (result.kind === 'next') await sendWithRetry(sock, jid, { text: result.text })
          else if (result.kind === 'complete') await sendWithRetry(sock, jid, { text: result.text })
          continue
        }

        const command = parseCommand(text, prefix)
        if (!command) {
          // Handle ordinary messages (not commands)
          if (!m.key.fromMe && text.trim().length > 0) {
            console.log(`[WhatsApp Message Handler] Incoming DM from ${jid}: "${text.slice(0, 50)}" (MsgID: ${m.key.id})`)

            // 1. Important Message Detection + Self Notification (IMMEDIATE, NO DELAY)
            void notifyAndyIfImportant(sock, jid, text, ownerNumber, repo)

            // 2. AI Auto-Reply Assistant (SCHEDULED WITH 10-SECOND DELAY)
            scheduleAutoReply(sock, jid, m.key.id, text, repo, 10000)
          }
          continue
        }

        // Restrict ALL commands to Andy (OWNER_NUMBER) only
        if (!owner) {
          logEvent('unauthorized_command_attempt', { jid, command: command.name, sender: m.key.participant ?? jid })
          await sendWithRetry(sock, jid, { text: "*🤖 Andy's Bot — ACCESS DENIED*\n\nThis bot is private. Commands can only be used by Andy." })
          continue
        }

        if (!allowCommand(jid)) { logEvent('rate_limited', { jid, command: command.name }); await sendWithRetry(sock, jid, { text: "*🤖 Andy's Bot — RATE LIMIT*\n\nTry again shortly." }); continue }
        logEvent('command_received', { jid, command: command.name })

        if (command.name === 'help' || command.name === 'menu') await sendWithRetry(sock, jid, { text: helpText(prefix) })
        else if (command.name === 'start-auto') {
          setAutoReplyEnabled(true)
          await sendWithRetry(sock, jid, { text: "✅ *Andy's Bot — AUTO-REPLY ENABLED*\n\nAI Auto-reply assistant is now active for DMs." })
        } else if (command.name === 'stop-auto') {
          setAutoReplyEnabled(false)
          await sendWithRetry(sock, jid, { text: "🛑 *Andy's Bot — AUTO-REPLY DISABLED*\n\nAI Auto-reply assistant has been turned off." })
        } else if (command.name === 'sendvoice') {
          const parsedArgs = parseSendVoiceArgs(command.raw)
          if (!parsedArgs) {
            await sendWithRetry(sock, jid, { text: `Usage: ${prefix}sendvoice <phone_number> <text> [voice_index]` })
          } else {
            const { phone: rawPhone, cleanPhone, textToSpeak, voiceIndex } = parsedArgs
            console.log(`[SendVoice] Input phone argument: "${rawPhone}" (Cleaned digits: "${cleanPhone}")`)

            // 1. Resolve WhatsApp JID using Baileys onWhatsApp API
            let targetJid: string | null = null
            console.log(`[SendVoice] Resolving WhatsApp JID for "${cleanPhone}" via sock.onWhatsApp...`)
            try {
              const results = await sock.onWhatsApp(cleanPhone)
              console.log(`[SendVoice] sock.onWhatsApp response:`, JSON.stringify(results))
              if (Array.isArray(results) && results.length > 0 && results[0]?.exists) {
                targetJid = results[0].jid
                console.log(`[SendVoice] Verified WhatsApp target JID: ${targetJid}`)
              }
            } catch (onWaErr: any) {
              console.warn(`[SendVoice] sock.onWhatsApp lookup error: ${onWaErr.message}`)
            }

            if (!targetJid) {
              console.warn(`[SendVoice] Number +${cleanPhone} is not registered on WhatsApp. Aborting delivery.`)
              await sendWithRetry(sock, jid, {
                text: `⚠️ *Andy's Bot — NUMBER NOT ON WHATSAPP*\n\nThe number +${cleanPhone} does not appear to be registered on WhatsApp. Voice message delivery aborted.`
              })
              continue
            }

            // 2. Generate TTS Audio
            console.log(`[SendVoice] Calling TTS API (voiceIndex=${voiceIndex}, text="${textToSpeak.slice(0, 40)}...")...`)
            let audio: { data: Buffer; contentType: string }
            try {
              audio = await tts(textToSpeak, voiceIndex)
              const audioSizeKb = (audio.data.length / 1024).toFixed(1)
              console.log(`[SendVoice] TTS generation succeeded: ${audioSizeKb} KB audio generated (type: ${audio.contentType})`)
            } catch (ttsErr: any) {
              console.error(`[SendVoice] TTS generation failed:`, ttsErr.message)
              await sendWithRetry(sock, jid, { text: `❌ *Andy's Bot — TTS FAILED*\n\nCould not generate audio. Error: ${ttsErr.message}` })
              continue
            }

            // 3. Send Voice Message via Baileys and log response
            console.log(`[SendVoice] Sending PTT voice message to target JID: ${targetJid}...`)
            try {
              const sendResult: any = await sendWithRetry(sock, targetJid, {
                audio: audio.data,
                mimetype: 'audio/mpeg',
                ptt: true
              })
              console.log(`[SendVoice] Baileys sendMessage response key:`, JSON.stringify(sendResult?.key ?? sendResult))

              // 4. Confirm success to Andy ONLY after Baileys send confirms
              await sendWithRetry(sock, jid, { text: `✅ *Andy's Bot — VOICE SENT*\n\nVoice message delivered to +${cleanPhone} (${targetJid}).\n*Text:* "${textToSpeak}"\n*Voice Index:* ${voiceIndex}\n*Audio Size:* ${(audio.data.length / 1024).toFixed(1)} KB` })
            } catch (sendErr: any) {
              console.error(`[SendVoice] Failed to send voice message to ${targetJid}:`, sendErr)
              await sendWithRetry(sock, jid, { text: `❌ *Andy's Bot — DELIVERY FAILED*\n\nCould not send voice message to +${cleanPhone} (${targetJid}).\nError: ${sendErr.message}` })
            }
          }
        } else if (command.name === 'quiz') {
          const remote = await (await import('./api.js')).telenorQuiz()
          await sendWithRetry(sock, jid, { text: beginQuiz(jid, remote) })
        } else if (command.name === 'hack') {
          const quoted = quotedMessage(m)
          if (!quoted) await sendWithRetry(sock, jid, { text: `*🤖 Andy's Bot — HACK PRANK*\n\n*Usage:* reply to a message with ${prefix}hack.` })
          else await sendHackPrank(text => sendWithRetry(sock, jid, { text }))
        } else if (command.name === 'vv') {
          const quoted = quotedMessage(m)
          if (!quoted) await sendWithRetry(sock, jid, { text: `Reply to a view-once image, video, audio, or document with ${prefix}vv.` })
          else await sendViewOnce(sock, jid, quoted)
        } else if (command.name === 'trans') {
          const quoted = quotedMessage(m)
          if (!quoted) {
            await sendWithRetry(sock, jid, { text: 'Reply to a voice message with .trans to transcribe it.' })
            continue
          }
          const content = unwrapMessage(quoted)
          const info = mediaInfo(content)
          if (!info || info.type !== 'audio') {
            await sendWithRetry(sock, jid, { text: 'Reply to a voice message with .trans to transcribe it.' })
            continue
          }

          try {
            console.log(`[Transcribe Command] Downloading voice note audio for message ID ${quoted.key?.id ?? 'quoted'}...`)
            const bytes = await downloadMedia(info.payload, info.type)
            console.log(`[Transcribe Command] Audio downloaded (${(bytes.length / 1024).toFixed(1)} KB, mime: ${info.mime}). Transcribing via Gemini...`)
            const text = await transcribeAudioWithGemini(bytes, info.mime)
            await sendWithRetry(sock, jid, { text: `🎙️ *Andy's Bot — VOICE TRANSCRIBED*\n\n${text}` })
          } catch (err: any) {
            console.error('[Transcribe Command] Failed:', err.message)
            await sendWithRetry(sock, jid, { text: `❌ *Andy's Bot — TRANSCRIPTION FAILED*\n\n${err.message || 'Could not transcribe voice message.'}` })
          }
        } else if (command.name === 'antidelete') {
          await sendWithRetry(sock, jid, { text: 'Anti-delete is always active in this build.' })
        } else if (command.name === 'tts') {
          if (!command.args.length) {
            await sendWithRetry(sock, jid, { text: `Usage: ${prefix}tts <text> [voiceIndex]` })
          } else {
            const { voiceIndex, textToSpeak } = parseVoiceIndexAndText(command.args)
            if (!textToSpeak) {
              await sendWithRetry(sock, jid, { text: `Usage: ${prefix}tts <text> [voiceIndex]` })
              continue
            }

            const audio = await tts(textToSpeak, voiceIndex)
            await sendWithRetry(sock, jid, { audio: audio.data, mimetype: 'audio/mpeg', ptt: false })
          }
        } else if (command.name === 'dl') {
          if (!command.args[0] || !isValidHttpUrl(command.args[0])) await sendWithRetry(sock, jid, { text: `Usage: ${prefix}dl https://example.com/video` })
          else await sendWithRetry(sock, jid, { text: formatApiResult(await downloader(command.args[0]), 'DOWNLOAD') })
        } else if (command.name === 'screenshot') {
          if (!command.args[0] || !isValidHttpUrl(command.args[0])) await sendWithRetry(sock, jid, { text: `Usage: ${prefix}screenshot https://example.com` })
          else { const image = await screenshot(command.args[0]); await sendWithRetry(sock, jid, { image: image.data, mimetype: image.contentType }) }
        } else {
          await handleApiCommand(sock, jid, command)
        }
      } catch (error) {
        console.error('message handler failed', error)
        await sendWithRetry(sock, m.key.remoteJid, { text: "*🤖 Andy's Bot — ERROR*\n\nSomething went wrong. Please try again." }).catch(() => undefined)
      }
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }: any) => { await handleMessages(messages, type) })
  sock.ev.on('messages.update', async (updates: any[]) => {
    for (const u of updates) {
      if (u.key?.remoteJid && u.key?.fromMe === false) {
        const status = u.update?.status
        if (status === 3 || status === 4 || status === 'READ') {
          console.log(`[Status Event] Incoming message read status update for ${u.key.remoteJid} (status=${status}, msgId: ${u.key.id})`)
          cancelPendingAutoReply(u.key.remoteJid, `Incoming message status changed to READ (status=${status}, msgId: ${u.key.id})`)
        }
      }
    }
    const revoked = updates.map((u: any) => ({ ...u, message: u.update?.message ?? u.message, key: u.key }))
    await handleMessages(revoked, 'notify')
  })

  return sock
}
