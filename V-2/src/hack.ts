const steps = [
  '*🤖 Andy\'s Bot — SYSTEM CHECK*\n\nInitializing secure analysis... ',
  '*🤖 Andy\'s Bot — SCANNING*\n\nReviewing message metadata... ',
  '*🤖 Andy\'s Bot — ENCRYPTION*\n\nGenerating fictional access tunnel... ',
  '*🤖 Andy\'s Bot — TRACE*\n\nRunning prank-level diagnostics... ',
  '*🤖 Andy\'s Bot — FINALIZING*\n\nPreparing dramatic results... '
]

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function sendHackPrank(send: (text: string) => Promise<unknown>) {
  const shuffled = [...steps].sort(() => Math.random() - 0.5)
  for (const step of shuffled) {
    await send(step)
    await wait(650)
  }
  return send('*🤖 Andy\'s Bot — RESULT*\n\nInformation uploading to dark web...\n\nHaha 😄')
}
