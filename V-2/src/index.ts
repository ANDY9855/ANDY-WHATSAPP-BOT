import 'dotenv/config'
import { MessageRepository } from './db.js'
import { startBot } from './whatsapp.js'
import { logEvent, startHealthServer } from './ops.js'
import { startDashboard } from './dashboard.js'

const repo = new MessageRepository()
let health: ReturnType<typeof startHealthServer> | undefined
let dashboard: ReturnType<typeof startDashboard> | undefined

async function main() {
  await repo.ping()
  health = startHealthServer(async () => { await repo.ping(); return { ok: true, service: 'BOT_404', database: 'up', timestamp: new Date().toISOString() } })
  dashboard = startDashboard(repo)
  const days = Number(process.env.MESSAGE_RETENTION_DAYS ?? 30)
  await repo.cleanup(Number.isFinite(days) && days > 0 ? days : 30)
  await startBot(repo)
  logEvent('bot_started', { owner: process.env.OWNER_NUMBER ?? '923000000000' })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    health?.close()
    dashboard?.close()
    await repo.close()
    logEvent('bot_stopped', { signal })
    process.exit(0)
  })
}

main().catch(async error => {
  console.error('Startup failed:', error)
  await repo.close()
  process.exit(1)
})
