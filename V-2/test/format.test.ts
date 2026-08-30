import test from 'node:test'
import assert from 'node:assert/strict'
import { formatApiResult } from '../src/format.js'

test('formats SpeechSter voices with indexes and names', () => {
  const out = formatApiResult({ success: true, voices: [{ index: 1, name: 'Andrew', language: 'English' }] }, 'SpeechSter Voices')
  assert.match(out, /1 — Andrew \(English\)/)
  assert.doesNotMatch(out, /"index"/)
})

test('formats Telenor quiz as answers instead of JSON', () => {
  const out = formatApiResult({ success: true, date: 'Today', questions: [{ number: 1, question: 'Capital?', answer: 'Islamabad' }] }, 'Quiz')
  assert.match(out, /\*Answer:\* Islamabad/)
  assert.doesNotMatch(out, /"questions"/)
})

test('formats generic API errors cleanly', () => {
  assert.equal(formatApiResult({ success: false, error: 'Bad request' }, 'API'), '*🤖 BOT_404 — ERROR*\n\nBad request')
})
