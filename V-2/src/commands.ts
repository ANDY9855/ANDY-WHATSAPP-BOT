export type CommandContext = {
  text: string
  isOwner: boolean
  hasQuoted: boolean
}

export type Command = { name: string; args: string[]; raw: string } | null

export function parseCommand(text: string, prefix = '.') : Command {
  const trimmed = text.trim()
  if (!trimmed.startsWith(prefix)) return null
  const parts = trimmed.slice(prefix.length).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return null
  return { name: parts[0].toLowerCase(), args: parts.slice(1), raw: trimmed }
}

export function parseVoiceIndexAndText(args: string[]): { voiceIndex: number; textToSpeak: string } {
  const cleanArgs = [...args]
  let voiceIndex = 314

  if (cleanArgs.length > 0 && cleanArgs[0] === '|') cleanArgs.shift()
  if (cleanArgs.length > 0 && cleanArgs[cleanArgs.length - 1] === '|') cleanArgs.pop()

  if (cleanArgs.length === 1 && /^\d+$/.test(cleanArgs[0])) {
    const parsed = parseInt(cleanArgs[0], 10)
    if (parsed > 0) voiceIndex = parsed
    return { voiceIndex, textToSpeak: '' }
  }

  if (cleanArgs.length > 1 && /^\d+$/.test(cleanArgs[cleanArgs.length - 1])) {
    const parsed = parseInt(cleanArgs.pop()!, 10)
    if (parsed > 0) voiceIndex = parsed
    if (cleanArgs.length > 0 && cleanArgs[cleanArgs.length - 1] === '|') cleanArgs.pop()
  } else if (cleanArgs.length > 1 && /^\d+$/.test(cleanArgs[0])) {
    const parsed = parseInt(cleanArgs.shift()!, 10)
    if (parsed > 0) voiceIndex = parsed
    if (cleanArgs.length > 0 && cleanArgs[0] === '|') cleanArgs.shift()
  }

  const textToSpeak = cleanArgs.join(' ').trim()
  return { voiceIndex, textToSpeak }
}

export function parseSendVoiceArgs(rawPayload: string): { phone: string; cleanPhone: string; textToSpeak: string; voiceIndex: number } | null {
  const cleanedPayload = rawPayload.replace(/^\.sendvoice\s*/i, '').trim()
  if (!cleanedPayload) return null

  // Match phone number (optional +, digits, spaces, hyphens, parentheses - min 7 chars)
  const match = cleanedPayload.match(/^(\+?[\d\s\-\(\)]{7,22})\s+(.*)$/)
  if (!match) return null

  const rawPhone = match[1].trim()
  let cleanDigits = rawPhone.replace(/\D/g, '')
  if (!cleanDigits) return null

  // Local Pakistani 11-digit number starting with 03 (e.g. 03001234567) -> 923001234567
  if (cleanDigits.length === 11 && cleanDigits.startsWith('03')) {
    cleanDigits = '92' + cleanDigits.slice(1)
  }

  const restText = match[2].trim()
  if (!restText) return null

  const restParts = restText.split(/\s+/).filter(Boolean)
  const { voiceIndex, textToSpeak } = parseVoiceIndexAndText(restParts)

  return {
    phone: rawPhone,
    cleanPhone: cleanDigits,
    textToSpeak,
    voiceIndex
  }
}

export function helpText(prefix = '.') {
  return [
    '*🤖 ANDY\'S BOT MENU*',
    '',
    `*${prefix}help* - Show this menu`, `*Usage: ${prefix}help*`, '',
    `*${prefix}start-auto* - Turn AI auto-reply assistant ON (owner only)`, `*Usage: ${prefix}start-auto*`, '',
    `*${prefix}stop-auto* - Turn AI auto-reply assistant OFF (owner only)`, `*Usage: ${prefix}stop-auto*`, '',
    `*${prefix}sendvoice* - Send voice note to contact (owner only)`, `*Usage: ${prefix}sendvoice <phone_number> <text> [voice_index]*`, '',
    `*${prefix}vv* - Recover a quoted view-once media`, `*Usage: reply to view-once msg with ${prefix}vv*`, '',
    `*${prefix}hack* - Run a fictional hacker prank`, `*Usage: reply to a message with ${prefix}hack*`, '',
    `*${prefix}antidelete* - Toggle anti-delete (owner only)`, `*Usage: ${prefix}antidelete on/off*`, '',
    `*${prefix}tts* - Convert text to voice`, `*Usage: ${prefix}tts <text> [voiceIndex]*`, '',
    `*${prefix}dl* - Fetch media from a link`, `*Usage: ${prefix}dl <url>*`, '',
    `*${prefix}screenshot* - Capture a webpage`, `*Usage: ${prefix}screenshot <url>*`, '',
    `*${prefix}voices* - List available TTS voices`, `*Usage: ${prefix}voices*`, '',
    `*${prefix}snapinfo* - Inspect a webpage's info`, `*Usage: ${prefix}snapinfo <url>*`, '',
    `*${prefix}image* - Generate an AI image`, `*Usage: ${prefix}image <prompt>*`, '',
    `*${prefix}video* - Generate an AI video`, `*Usage: ${prefix}video <prompt>*`, '',
    `*${prefix}imgchat* - Chat about an image`, `*Usage: ${prefix}imgchat <image-url> <prompt>*`, '',
    `*${prefix}mail* - Manage temp mail`, `*Usage: ${prefix}mail create/inbox/read/delete*`, '',
    `*${prefix}med* - Search medicine info`, `*Usage: ${prefix}med <name>*`, '',
    `*${prefix}medinfo* - Get medicine details by ID`, `*Usage: ${prefix}medinfo <id>*`, '',
    `*${prefix}manga* - Search/read manga`, `*Usage: ${prefix}manga search/chapters/pages <value>*`, '',
    `*${prefix}novel* - Search/read novels`, `*Usage: ${prefix}novel search/chapters/read <value>*`, '',
    `*${prefix}unovel* - Search unofficial novels`, `*Usage: ${prefix}unovel search/detail/novels <value>*`, '',
    `*${prefix}wiki* - Get a Wikipedia article`, `*Usage: ${prefix}wiki <article>*`, '',
    `*${prefix}movie* - Get movie info`, `*Usage: ${prefix}movie <title>*`, '',
    `*${prefix}zip* - Zip a url's content`, `*Usage: ${prefix}zip <url>*`, '',
    `*${prefix}hand* - Handwriting-style text image`, `*Usage: ${prefix}hand <text>*`, '',
    `*${prefix}quiz* - Start a quiz`, `*Usage: ${prefix}quiz*`, '',
    `*${prefix}n8n* - n8n workflow templates`, `*Usage: ${prefix}n8n categories/templates*`, '',
    `*${prefix}courses* - Search free courses`, `*Usage: ${prefix}courses <query>*`
  ].join('\n')
}

export function isOwnerJid(jid: string, ownerNumber: string) {
  const normalized = jid.split(':')[0].split('@')[0].replace(/\D/g, '')
  return normalized === ownerNumber.replace(/\D/g, '')
}
