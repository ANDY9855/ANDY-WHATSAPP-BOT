import * as api from './api.js'
import { isValidHttpUrl } from './api.js'
import { type Command, parseVoiceIndexAndText } from './commands.js'
import { formatApiResult } from './format.js'

const textResult = (value: unknown, title = "Andy's Bot") => formatApiResult(value, title)
const need = (args: string[], usage: string) => args[0] ? null : usage

export async function handleApiCommand(sock: any, jid: string, command: Exclude<Command, null>) {
  const a = command.args
  const name = command.name
  if (name === 'voices') return sock.sendMessage(jid, { text: textResult(await api.voices(), 'SpeechSter Voices') })
  if (name === 'tts') {
    const missing = need(a, '.tts <text> [voiceIndex]'); if (missing) return sock.sendMessage(jid, { text: missing })
    const { voiceIndex, textToSpeak } = parseVoiceIndexAndText(a)
    if (!textToSpeak) return sock.sendMessage(jid, { text: '.tts <text> [voiceIndex]' })

    const out = await api.tts(textToSpeak, voiceIndex)
    return sock.sendMessage(jid, { audio: out.data, mimetype: 'audio/mpeg', ptt: false })
  }
  if (name === 'dl') {
    const missing = need(a, '.dl <url>'); if (missing || !isValidHttpUrl(a[0])) return sock.sendMessage(jid, { text: missing ?? 'Only http/https URLs are accepted.' })
    return sock.sendMessage(jid, { text: textResult(await api.downloader(a[0])) })
  }
  if (name === 'screenshot') {
    const missing = need(a, '.screenshot <url>'); if (missing || !isValidHttpUrl(a[0])) return sock.sendMessage(jid, { text: missing ?? 'Only http/https URLs are accepted.' })
    const out = await api.screenshot(a[0]); return sock.sendMessage(jid, { image: out.data, mimetype: out.contentType })
  }
  if (name === 'snapinfo') {
    const missing = need(a, '.snapinfo <url>'); if (missing || !isValidHttpUrl(a[0])) return sock.sendMessage(jid, { text: missing ?? 'Only http/https URLs are accepted.' })
    return sock.sendMessage(jid, { text: textResult(await api.websnapInfo(a[0])) })
  }
  if (name === 'image') { const missing = need(a, '.image <prompt>'); if (missing) return sock.sendMessage(jid, { text: missing }); const out = await api.imageGenerate(a.join(' ')); return sock.sendMessage(jid, { image: { url: out.imageUrl }, caption: out.prompt ?? a.join(' ') }) }
  if (name === 'video') { const missing = need(a, '.video <prompt>'); if (missing) return sock.sendMessage(jid, { text: missing }); return sock.sendMessage(jid, { text: 'The `/api/ptv` endpoint requires `prompt`, `imageBase64`, `ratio`, and `duration`. Reply-to-image upload support is required before this command can be enabled safely.' }) }
  if (name === 'imgchat') { const missing = need(a, '.imgchat <image-url> <prompt>'); if (missing || !isValidHttpUrl(a[0])) return sock.sendMessage(jid, { text: missing ?? 'Only http/https image URLs are accepted.' }); return sock.sendMessage(jid, { text: textResult(await api.imageChat(a[0], a.slice(1).join(' '))) }) }
  if (name === 'mail') return sock.sendMessage(jid, { text: textResult(await api.tempMail(a[0] ?? 'create', a[1])) })
  if (name === 'med') { const missing = need(a, '.med <name>'); if (missing) return sock.sendMessage(jid, { text: missing }); return sock.sendMessage(jid, { text: textResult(await api.medicineSearch(a.join(' '))) }) }
  if (name === 'medinfo') { const missing = need(a, '.medinfo <id>'); if (missing) return sock.sendMessage(jid, { text: missing }); return sock.sendMessage(jid, { text: textResult(await api.medicineDetails(a[0])) }) }
  if (name === 'manga') return sock.sendMessage(jid, { text: textResult(await api.manga(a[0] ?? 'search', a.slice(1).join(' '))) })
  if (name === 'novel') return sock.sendMessage(jid, { text: textResult(await api.novel(a[0] ?? 'search', a.slice(1).join(' '))) })
  if (name === 'unovel') return sock.sendMessage(jid, { text: textResult(await api.urduNovel(a[0] ?? 'search', a.slice(1).join(' '))) })
  if (name === 'movie') { const missing = need(a, '.movie <title>'); if (missing) return sock.sendMessage(jid, { text: missing }); return sock.sendMessage(jid, { text: textResult(await api.movieSearch(a.join(' '))) }) }
  if (name === 'wiki') {
    const missing = need(a, '.wiki <article>'); if (missing) return sock.sendMessage(jid, { text: missing })
    try {
      const out = await api.wikipediaPdf(a.join('_'))
      return sock.sendMessage(jid, { document: out.data, mimetype: out.contentType, fileName: 'wikipedia.pdf' })
    } catch {
      const summary = await api.wikipediaSummary(a.join(' '))
      return sock.sendMessage(jid, { text: textResult(summary, 'Wikipedia Summary') })
    }
  }
  if (name === 'zip') { const missing = need(a, '.zip <url>'); if (missing || !isValidHttpUrl(a[0])) return sock.sendMessage(jid, { text: missing ?? 'Only http/https URLs are accepted.' }); const out = await api.websiteZip(a[0]); return sock.sendMessage(jid, { document: out.data, mimetype: out.contentType, fileName: 'website.zip' }) }
  if (name === 'cert') return sock.sendMessage(jid, { text: 'Use the certificate API from an approved template workflow; raw certificate payloads are intentionally not accepted from chat.' })
  if (name === 'hand') { const missing = need(a, '.hand <text>'); if (missing) return sock.sendMessage(jid, { text: missing }); const out = await api.handwriting(a.join(' ')); return sock.sendMessage(jid, { image: out.data, mimetype: out.contentType }) }
  if (name === 'quiz') return sock.sendMessage(jid, { text: textResult(await api.telenorQuiz(), 'My Telenor Quiz') })
  if (name === 'n8n') return sock.sendMessage(jid, { text: textResult(await api.n8n(a[0] ?? 'categories')) })
  if (name === 'courses') return sock.sendMessage(jid, { text: textResult(await api.courses(a.join(' '))) })
  return false
}