const steps = [
  '*🤖 BOT_404 — SYSTEM CHECK*\n\nInitializing secure analysis... ',
  '*🤖 BOT_404 — SCANNING*\n\nReviewing message metadata... ',
  '*🤖 BOT_404 — ENCRYPTION*\n\nGenerating fictional access tunnel... ',
  '*🤖 BOT_404 — TRACE*\n\nRunning prank-level diagnostics... ',
  '*🤖 BOT_404 — FINALIZING*\n\nPreparing dramatic results... '
]

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function sendHackPrank(send: (text: string) => Promise<unknown>) {
  const shuffled = [...steps].sort(() => Math.random() - 0.5)
  for (const step of shuffled) {
    await send(step)
    await wait(650)
  }
  return send('*🤖 BOT_404 — RESULT*\n\nInformation uploading to dark web...\n\nHaha 😄')
}
