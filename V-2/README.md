# BOT_404 — WhatsApp Bot

A local Node.js/TypeScript WhatsApp automation bot named **BOT_404**, using Baileys and MariaDB from XAMPP. It implements always-on anti-delete capture, quoted view-once recovery with `.vv`, owner forwarding to `OWNER_NUMBER`, and a catalog-wide configurable API adapter layer.

## Important operational note

Baileys communicates through the WhatsApp Web protocol and is not an official WhatsApp Business API. It must be used only with an account you control, with consent from chat participants, and in accordance with WhatsApp’s terms and applicable privacy law. All remote commands route through the configurable `API_BASE_URL` backend. External endpoints may return HTTP 403/405/400 if anti-bot protection or an endpoint-specific requirement applies; the adapters are implemented and configurable but must be rechecked from your own network before production use.

## Requirements

Install Node.js 20 or newer and XAMPP with MariaDB running on port 3306. Import `sql/schema.sql` using phpMyAdmin or the MariaDB command line. Then copy `.env.example` to `.env` and update the database values if your XAMPP installation uses a password.

```bash
cp .env.example .env
npm install
npm run build
npm test
npm start
```

On first start, scan the QR code printed in the terminal from the WhatsApp account that will run the bot. Session data is stored in `auth_info/`; do not commit or share that directory.

## Commands

| Command | Behavior |
|---|---|
| `.help` or `.menu` | Shows the command menu. |
| `.vv` | Reply to a view-once image, video, audio, or document. The bot downloads and returns a normal copy immediately. |
| `.antidelete on` or `.antidelete off` | Owner-only informational command. Anti-delete remains active by design and cannot be switched off in this build. |
| `.tts <text>` | Calls the configured TTS API adapter and returns audio. |
| `.dl <url>` | Calls the configured downloader API adapter and returns the JSON result. |
| `.screenshot <url>` | Calls the configured screenshot API adapter and returns the image. |
| `.voices`, `.snapinfo` | TTS voice listing and WebSnap metadata. |
| `.image`, `.video`, `.imgchat` | PixelSter image/video generation and VisionSter image analysis. |
| `.mail` | TempSter disposable-mail actions. |
| `.med`, `.medinfo` | MedSter search and details. |
| `.manga`, `.novel`, `.unovel`, `.movie` | Manga, novel, Urdu-novel, and CineSter searches/actions. |
| `.wiki`, `.zip`, `.cert`, `.hand` | Wikipedia PDF, website ZIP, certificate, and handwriting adapters. |
| `.quiz`, `.n8n`, `.courses` | Telenor quiz, n8n workflow, and course search adapters. |

Anti-delete is active without a command. The bot stores incoming messages and media locally. When a revoke protocol event is received, it forwards a recovery notice and the stored text or attachment to the configured owner JID `OWNER_NUMBER` (set this in `.env`).

## Local dashboard and operations

The bot exposes a health endpoint at `http://127.0.0.1:8787/health` and a localhost-only operations API at `http://127.0.0.1:8788/api/status`. Set `DASHBOARD_TOKEN` before production use; when `NODE_ENV=production`, requests without the bearer token are rejected. The dashboard can add trusted users or groups through `POST /api/trusted` with a JSON body containing `jid`, `type`, and an optional `note`. It is intentionally bound to `127.0.0.1` and should not be port-forwarded publicly.

For restart supervision, build the project and run `pm2 start ecosystem.config.cjs`. The included `scripts/backup.sh` exports MariaDB and the local media directory into timestamped backup folders. Test restores on a separate copy before treating backups as reliable.

## Audit commands

```bash
npm run build
npm run lint
npm test
```

The project includes adapters for the API families in use: DriveUp, WebSnap, SpeechSter, AllDL, PixelSter, VisionSter, TempSter, MedSter, TranScribe, MangaSter, NovelSter, UNovelSter, CineSter, Wikster, WebZip, CertSter, HandSter, Telenor, n8nSter, and Courses. A 403/405/400 from an endpoint indicates backend-side anti-bot protection or an endpoint-specific request requirement from the current network; it is recorded rather than hidden. DriveUp and some POST APIs may require provider-specific authentication or multipart payloads and are intentionally not guessed from chat.

## Project layout

`src/whatsapp.ts` contains the Baileys connection and message event handlers. `src/db.ts` contains the MariaDB repository, retention, trusted-entity, usage, and audit layers. `src/api.ts` and `src/api-commands.ts` contain the centralized API adapter layer, pointed at `API_BASE_URL`. `src/commands.ts` contains parsing and authorization. `src/ops.ts` provides rate limiting, health, readiness, and structured logging. `src/dashboard.ts` provides the localhost-only operations API. `sql/schema.sql` creates the required tables and indexes. `ecosystem.config.cjs` and `scripts/backup.sh` support local production operations. `test/commands.test.ts` contains deterministic unit tests.
