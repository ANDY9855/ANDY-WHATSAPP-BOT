import test from 'node:test'
import assert from 'node:assert/strict'
import { isOwnerJid, parseCommand, parseVoiceIndexAndText, parseSendVoiceArgs } from '../src/commands.js'
import { isValidHttpUrl } from '../src/api.js'
import { isAutoReplyEnabled, setAutoReplyEnabled, isExcludedContact, cancelPendingAutoReply, scheduleAutoReply, DISCLOSURE_TEXT } from '../src/auto-reply.js'

test('parses dot commands case-insensitively', () => {
  assert.deepEqual(parseCommand('  .VV  '), { name: 'vv', args: [], raw: '.VV' })
  assert.deepEqual(parseCommand('.tts hello world'), { name: 'tts', args: ['hello', 'world'], raw: '.tts hello world' })
  assert.deepEqual(parseCommand('.start-auto'), { name: 'start-auto', args: [], raw: '.start-auto' })
  assert.deepEqual(parseCommand('.stop-auto'), { name: 'stop-auto', args: [], raw: '.stop-auto' })
  assert.deepEqual(parseCommand('.sendvoice 923001234567 Hello 314'), { name: 'sendvoice', args: ['923001234567', 'Hello', '314'], raw: '.sendvoice 923001234567 Hello 314' })
})

test('parses sendvoice args across various phone number formats', () => {
  // Case 1: Plain country-code number with voice index
  const c1 = parseSendVoiceArgs('.sendvoice 923001234567 Hello there 314')
  assert.deepEqual(c1, { phone: '923001234567', cleanPhone: '923001234567', textToSpeak: 'Hello there', voiceIndex: 314 })

  // Case 2: Plus-prefixed country-code number
  const c2 = parseSendVoiceArgs('.sendvoice +923001234567 Hello there 314')
  assert.deepEqual(c2, { phone: '+923001234567', cleanPhone: '923001234567', textToSpeak: 'Hello there', voiceIndex: 314 })

  // Case 3: Plus-prefixed number with internal spaces
  const c3 = parseSendVoiceArgs('.sendvoice +92 300 1234567 Hello there 314')
  assert.deepEqual(c3, { phone: '+92 300 1234567', cleanPhone: '923001234567', textToSpeak: 'Hello there', voiceIndex: 314 })

  // Case 4: No voice index provided (should fallback to default 314)
  const c4 = parseSendVoiceArgs('.sendvoice 923001234567 Hello there')
  assert.deepEqual(c4, { phone: '923001234567', cleanPhone: '923001234567', textToSpeak: 'Hello there', voiceIndex: 314 })

  // Case 5: Local Pakistani 11-digit number starting with 03 (auto-converted to 923...)
  const c5 = parseSendVoiceArgs('.sendvoice 03001234567 Hello there')
  assert.deepEqual(c5, { phone: '03001234567', cleanPhone: '923001234567', textToSpeak: 'Hello there', voiceIndex: 314 })
})

test('parses voice index and text from tts args correctly with default 314', () => {
  assert.deepEqual(parseVoiceIndexAndText(['kese', 'ho', 'bhai', '313']), { voiceIndex: 313, textToSpeak: 'kese ho bhai' })
  assert.deepEqual(parseVoiceIndexAndText(['hello', '313']), { voiceIndex: 313, textToSpeak: 'hello' })
  assert.deepEqual(parseVoiceIndexAndText(['313', 'hello']), { voiceIndex: 313, textToSpeak: 'hello' })
  assert.deepEqual(parseVoiceIndexAndText(['kese', 'ho', 'bhai']), { voiceIndex: 314, textToSpeak: 'kese ho bhai' })
  assert.deepEqual(parseVoiceIndexAndText(['hello', 'world']), { voiceIndex: 314, textToSpeak: 'hello world' })
  assert.deepEqual(parseVoiceIndexAndText(['313']), { voiceIndex: 313, textToSpeak: '' })
})

test('ignores ordinary messages and unsupported prefixes', () => {
  assert.equal(parseCommand('hello'), null)
  assert.equal(parseCommand('!help'), null)
})

test('normalizes owner JIDs and rejects a different number', () => {
  assert.equal(isOwnerJid('923000000000@s.whatsapp.net', '923000000000'), true)
  assert.equal(isOwnerJid('923000000000:4@s.whatsapp.net', '923000000000'), true)
  assert.equal(isOwnerJid('923000000001@s.whatsapp.net', '923000000000'), false)
})

test('accepts only http and https URLs', () => {
  assert.equal(isValidHttpUrl('https://example.com/a?q=1'), true)
  assert.equal(isValidHttpUrl('http://localhost:3000'), true)
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false)
  assert.equal(isValidHttpUrl('not-a-url'), false)
})

test('toggles and checks auto-reply state', () => {
  setAutoReplyEnabled(false)
  assert.equal(isAutoReplyEnabled(), false)
  setAutoReplyEnabled(true)
  assert.equal(isAutoReplyEnabled(), true)
  setAutoReplyEnabled(false) // Restore default OFF
  assert.equal(isAutoReplyEnabled(), false)
})

test('checks auto-reply exclude list containing boss number', () => {
  assert.equal(isExcludedContact('923333848611@s.whatsapp.net'), true)
  assert.equal(isExcludedContact('923999999999@s.whatsapp.net'), false)
})

test('verifies mandatory disclosure string contents', () => {
  assert.match(DISCLOSURE_TEXT, /Andy's AI assistant replying/)
})

test('cancels pending auto-reply timer on read or manual reply', () => {
  setAutoReplyEnabled(true)
  const fakeSock = { sendMessage: async () => {} }
  const fakeRepo = { getRecentMessages: async () => [] } as any
  const testJid = '923123456789@s.whatsapp.net'

  scheduleAutoReply(fakeSock, testJid, 'msg-123', 'Hello Andy', fakeRepo, 10000)
  const cancelled = cancelPendingAutoReply(testJid, 'Andy read message')
  assert.equal(cancelled, true)

  setAutoReplyEnabled(false)
})
