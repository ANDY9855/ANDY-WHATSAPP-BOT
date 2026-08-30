# WhatsApp Bot Monorepo

Local-first WhatsApp automation built on top of [Baileys](https://github.com/WhiskeySockets/Baileys) (unofficial WhatsApp Web protocol). This repository contains two generations of the same bot:

| Version | Status | Stack | Highlights |
|---------|--------|-------|------------|
| **V-1** | Stable | Node.js + JavaScript (ESM) | 25+ commands, AI chat, image gen, downloads, web tools |
| **V-2** | Under development | Node.js + TypeScript | Anti-delete capture, view-once recovery, MariaDB, local dashboard |

Both bots are designed to run **entirely on your own machine** and communicate with WhatsApp through the Web protocol. They do not depend on any managed or third-party cloud API.

---

## Quick Start

Requirements for both versions: **Node.js ≥ 20** (V-1 needs ≥ 18), and WhatsApp access to scan a QR code. V-2 additionally needs **MariaDB** (XAMPP works).

```bash
# V-1 (stable)
cd V-1
npm install
cp .env.example .env        # fill in your own keys
npm start

# V-2 (in development)
cd V-2
cp .env.example .env        # fill in DB + own keys
npm install
npm run build
npm start
```

On first start a **QR code** is printed in the terminal. Open WhatsApp on your phone → **Linked Devices** → **Link a Device** → scan it. The session persists locally (V-1: `auth_info_baileys/`, V-2: `auth_info/`).

> **Group / chat safety:** Baileys is not an official WhatsApp API. Use it only with accounts you control and with the consent of participants, and in line with WhatsApp's terms and applicable law.

---

## Security & Keys

- **Never share or commit API keys.** The bots already ship without any bundled keys — all credentials come from your own local `.env` file, which is git-ignored.
- The generated WhatsApp auth folders (`auth_info_baileys/`, `auth_info/`) contain your logged-in session. Keep them private and never push them to a repository.
- V-2's dashboard/health ports bind to `127.0.0.1` only and require a `DASHBOARD_TOKEN` in production. Do not port-forward them publicly.

---

## Configuration

Every external service a command uses must be configured by you in local `.env`. Nothing is hardcoded to a remote server.

### V-1

Key variables (full table in [`V-1/README.md`](V-1/README.md)):

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Your own Groq key for `.aibot` (get one at console.groq.com) |
| `API_BASE_URL` | `http://127.0.0.1:3000` | Base URL of the local/self-hosted API that powers most commands |
| `BOT_PREFIX` | `.` | Command prefix for regular users |
| `SELF_PREFIX` | `!!` | Command prefix for the bot owner |
| `SIGNATURE` | `> BOT_404` | Footer appended to outgoing messages |

Most commands route through the configurable API backend. `aibot` calls Groq directly, `search` uses DuckDuckGo, and `dl`/`audio` use a local `yt-dlp`.

### V-2

Key variables (full list in [`V-2/.env.example`](V-2/.env.example)):

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | Local MariaDB connection |
| `OWNER_NUMBER` | — | WhatsApp number that receives anti-delete/`.vv` recoveries |
| `API_BASE_URL` | `http://127.0.0.1:3000` | Base URL of the local/self-hosted API backend |
| `DASHBOARD_TOKEN` | — | Bearer token for the local operations API (required in production) |
| `MEDIA_DIR` | `./data/media` | Where quoted view-once media is stored locally |

---

## V-1 — Stable bot

JavaScript bot with 25+ commands across categories: AI chat/vision, image generation, media downloading (YouTube, TikTok, Instagram, and more via the API backend, plus local `yt-dlp`), TTS, website screenshot/zip/PDF tools, manga/novel readers, movie & medicine search, disposable email, n8n templates, and course listings.

Notable built-in safety features:

- Rate limiting (max 5 commands per 10 s per user) and fuzzy command matching
- Configurable concurrency queue and automatic reconnection with backoff
- Message signing (signature footer) and image watermarking
- Dual prefix: owner commands via `!!`, user commands via `.`

Setup and command reference: [`V-1/README.md`](V-1/README.md).

---

## V-2 — Next-generation (under development)

TypeScript rewrite currently in active development. It keeps the V-1 command surface and adds a local-first infrastructure layer:

- **Always-on anti-delete capture** — incoming messages and media are stored locally (MariaDB + disk); when a revoke event arrives the bot forwards a recovery notice with the stored content to the configured owner.
- **View-once recovery** — quoting a received view-once message with `.vv` returns a normal downloadable copy.
- **Local database** — MariaDB schema (in `sql/schema.sql`) for messages, retention (30 days default), trusted entities, usage, and audit logs.
- **Local ops dashboard** — health and status endpoints bound to `127.0.0.1` (health on `:8787`, operations API on `:8788`), with token-protected trusted-entity management.
- **Centralized API adapter layer** — all remote commands go through one configurable adapter module (`src/api.ts`); no provider URL is hardcoded.

Status: several commands are wired to the API adapter and may be disabled until the local backend is finalized. Setup and details: [`V-2/README.md`](V-2/README.md).

---

## Repository Layout

```
bot/
├── README.md              # This file
├── V-1/                   # Stable JavaScript bot
│   ├── index.js           # Entry point
│   ├── src/               # Core modules + src/commands/* command handlers
│   ├── API_Documentation.md  # Reference for the configurable API backend
│   └── README.md
└── V-2/                   # TypeScript rewrite (in development)
    ├── src/               # whatsapp, db, api adapter, commands, ops, dashboard
    ├── sql/schema.sql     # MariaDB schema
    ├── test/              # Unit tests
    └── README.md
```

---

## License

MIT