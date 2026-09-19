import type { MessageRepository, StoredMessage } from './db.js'

function getGeminiKeys(): string[] {
  const matchingEnvNames = Object.keys(process.env).filter(k => /^GEMINI_API_KEY(_\d+)?$/i.test(k))
  const envKeys = matchingEnvNames.map(k => process.env[k])
  const rawList = envKeys.flatMap(k => (k ? k.split(',') : [])).map(k => k.trim()).filter(Boolean)
  return Array.from(new Set(rawList))
}

export type ImportanceAnalysis = {
  isImportant: boolean
  summary: string
  reason: string
}

export async function checkMessageImportance(
  senderJid: string,
  incomingText: string,
  history: StoredMessage[] = []
): Promise<ImportanceAnalysis | null> {
  const keys = getGeminiKeys()
  if (keys.length === 0) return null

  const prompt = `Analyze this incoming WhatsApp message and recent conversation context for Andy.
Determine if this message is IMPORTANT or URGENT (e.g. urgent family matters, job offers, critical financial transactions, emergencies, scheduling urgent meetings, client issues, system downtime, etc.).

Incoming Message: "${incomingText}"
Recent Context: ${JSON.stringify(history.slice(-5).map(m => m.textBody || m.caption || ''))}

Return strictly valid JSON with no markdown block markers:
{
  "isImportant": boolean,
  "summary": "1-2 sentence concise summary of what the sender said",
  "reason": "1 sentence explanation of why this was flagged as important/urgent"
}`

  const models = ['gemini-2.0-flash', 'gemini-3.6-flash', 'gemini-1.5-flash']

  for (const key of keys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 6000)

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        })

        clearTimeout(timeoutId)
        if (response.status === 404 || !response.ok) continue

        const data: any = await response.json()
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (!rawText) continue

        const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(jsonString) as ImportanceAnalysis

        if (typeof parsed.isImportant === 'boolean') {
          return parsed
        }
      } catch (err) {
        // Try next key/model on failure
      }
    }
  }

  return null
}

export async function notifyAndyIfImportant(
  sock: any,
  senderJid: string,
  incomingText: string,
  ownerNumber: string,
  repo: MessageRepository
): Promise<void> {
  // Do not analyze messages from groups or newsletters
  if (senderJid.endsWith('@g.us') || senderJid.endsWith('@newsletter')) return

  // Do not self-notify on messages sent by Andy himself
  const ownerJid = `${ownerNumber.replace(/\D/g, '')}@s.whatsapp.net`
  const senderNumber = senderJid.split('@')[0].replace(/\D/g, '')
  if (senderNumber === ownerNumber.replace(/\D/g, '')) return

  try {
    const history = await repo.getRecentMessages(senderJid, 5).catch(() => [])
    const analysis = await checkMessageImportance(senderJid, incomingText, history)

    if (analysis && analysis.isImportant) {
      const notificationText = [
        `🚨 *IMPORTANT MESSAGE ALERT*`,
        ``,
        `*From:* +${senderNumber}`,
        `*Summary:* ${analysis.summary}`,
        `*Why Important:* ${analysis.reason}`,
        ``,
        `_Received on Andy's Bot_`
      ].join('\n')

      await sock.sendMessage(ownerJid, { text: notificationText })
      console.log(`[ImportanceDetector] Sent self-notification to ${ownerJid} for message from ${senderNumber}`)
    }
  } catch (err) {
    console.error('[ImportanceDetector] Error analyzing importance:', err)
  }
}
