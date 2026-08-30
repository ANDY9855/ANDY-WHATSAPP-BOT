import test from 'node:test'
import assert from 'node:assert/strict'
import { sendHackPrank } from '../src/hack.js'

test('hack prank sends staged fictional messages and disclaimer', async () => {
  const messages: string[] = []
  await sendHackPrank(async text => { messages.push(text) })
  assert.equal(messages.length, 6)
  assert.match(messages.at(-1) ?? '', /Information uploading to dark web/)
  assert.match(messages.at(-1) ?? '', /Haha/)
})
