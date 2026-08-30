import test from 'node:test'
import assert from 'node:assert/strict'
import { answerQuiz, beginQuiz, buildQuestions, hasQuiz, parseOption } from '../src/quiz.js'

test('builds exactly ten four-choice questions', () => {
  const questions = buildQuestions({ questions: [] })
  assert.equal(questions.length, 10)
  assert.ok(questions.every(q => q.options.length === 4 && q.answer >= 0 && q.answer < 4))
})

test('accepts option commands and plain numeric choices', () => {
  assert.equal(parseOption('.option-1'), 0)
  assert.equal(parseOption('.option-4'), 3)
  assert.equal(parseOption('2'), 1)
  assert.equal(parseOption('5'), null)
})

test('completes a ten-question session with a report card', () => {
  const jid = 'test-chat@s.whatsapp.net'
  const first = beginQuiz(jid, { questions: [] })
  assert.match(first, /Question 1\/10/)
  for (let i = 0; i < 9; i++) assert.equal(answerQuiz(jid, 0).kind, 'next')
  const final = answerQuiz(jid, 0)
  assert.equal(final.kind, 'complete')
  assert.match(final.text, /BOT_404 REPORT CARD/)
  assert.match(final.text, /\*Score:\* 1\/10/)
  assert.equal(hasQuiz(jid), false)
})
