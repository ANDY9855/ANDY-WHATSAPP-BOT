# Sasti Automation — WhatsApp Bot

A feature-rich WhatsApp bot built with Node.js and Baileys (unofficial WhatsApp Web API). Provides 25+ commands spanning AI chat, image generation, media downloading, web tools, entertainment, and utilities.

---

## Features

### AI & Image
| Command | Aliases | Description |
|---------|---------|-------------|
| `.aibot` | — | AI chatbot powered by Groq (LLaMA 3.3 70B) |
| `.vision` | — | Analyze an image with AI (reply with or caption an image) |
| `.img` | — | Generate AI images from text prompt (supports ratios, bulk up to 50) |
| `.i2i` | `.pti` | Image-to-image AI transformation (reply to an image) |

### Media & Downloading
| Command | Aliases | Description |
|---------|---------|-------------|
| `.dl` | — | Download video via yt-dlp (MP4) |
| `.audio` | — | Download audio via yt-dlp (MP3) |
| `.alldl` | — | Universal downloader (YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Snapchat, SoundCloud, CapCut, etc.) |
| `.tts` | — | Text-to-speech conversion (MP3 audio) |
| `.voices` | — | List available TTS voices |

### Web Tools
| Command | Aliases | Description |
|---------|---------|-------------|
| `.screenshot` | `.ss` | Capture a website screenshot (PNG or PDF) |
| `.zip` | — | Archive a website as downloadable ZIP |
| `.wikipdf` | `.wiki` | Generate a Wikipedia article as PDF |
| `.cert` | — | Generate a PDF certificate (8 templates) |
| `.search` | — | DuckDuckGo web search |

### Entertainment & Reference
| Command | Aliases | Description |
|---------|---------|-------------|
| `.manga` | — | Manga reader (search, chapters, pages) |
| `.novel` | — | Novel reader (search, chapters, read with EN/UR support) |
| `.unovel` | — | Urdu novels library (categories, series, authors, download) |
| `.movie` | — | Search movies & TV shows (poster, cast, IMDB link) |
| `.med` | — | Medicine info lookup (price, dosage, side effects, interactions) |
| `.courses` | — | Browse free premium online courses |

### Utility
| Command | Aliases | Description |
|---------|---------|-------------|
| `.menu` | — | Show interactive help menu |
| `.ping` | — | Health check (responds "Pong! Bot is alive.") |
| `.mail` | — | Disposable email service (create, inbox, read, delete) |
| `.n8n` | — | Browse n8n automation workflow templates (filter by category, complexity, trigger type) |

### Bonus Features
- **Spam protection** — max 5 commands per 10-second window per user; 30-second block on abuse
- **Fuzzy command matching** — Levenshtein distance suggests corrections for typos
- **Concurrency queue** — configurable parallel command processing (`MAX_CONCURRENT`)
- **Auto-reconnection** — exponential backoff on disconnect (up to 5 retries)
- **Message signing** — signature footer appended to all outgoing messages
- **Image watermarking** — bot icon overlaid on generated images via Sharp
- **Health logging** — periodic connection/queue status every 5 minutes
- **Dual prefix** — separate prefix for bot owner (`!!`) vs. regular users (`.`)

---

## Project Structure

```
sasti-automation/
├── .env                          # Environment variables (API keys, config)
├── icon.png                      # Bot avatar / watermark image
├── index.js                      # Entry point — starts the bot
├── package.json                  # Project metadata, dependencies, scripts
│
├── auth_info_baileys/            # WhatsApp auth session (auto-generated)
│   ├── creds.json
│   ├── pre-key-*.json
│   ├── sender-key-*.json
│   └── ...
│
├── downloads/                    # Temporary media downloads (yt-dlp)
│
├── logs/
│   ├── bot.log                   # Runtime log (pino)
│   └── health.log                # Health check log (every 5 min)
│
└── src/
    ├── bot.js                    # WhatsApp socket setup, connection lifecycle, event handling
    ├── config.js                 # Reads .env, exports all config constants
    ├── downloader.js             # yt-dlp child-process wrapper
    ├── helpers.js                # Send-utility functions (text, image, audio, video, document, react)
    ├── http.js                   # HTTP fetch with timeout (fetchJson, fetchBuffer)
    ├── logger.js                 # Pino logger — stdout + file output
    ├── media.js                  # Image watermarking with Sharp
    ├── queue.js                  # p-queue concurrency queue
    ├── router.js                 # Command dispatcher (fuzzy matching, spam protection, queuing)
    ├── signature.js              # Appends signature footer to every message
    │
    └── commands/                 # Command handlers
        ├── ai.js                 # .aibot — Groq AI chat
        ├── alldl.js              # .alldl — Universal media download
        ├── certificate.js        # .cert — PDF certificate generator
        ├── courses.js            # .courses — Free course listings
        ├── download.js           # .dl / .audio — yt-dlp download
        ├── image.js              # .img / .i2i — AI image generation & transformation
        ├── mail.js               # .mail — Disposable email
        ├── manga.js              # .manga — Manga reader
        ├── medicine.js           # .med — Medicine info lookup
        ├── menu.js               # .menu — Help / command listing
        ├── movie.js              # .movie — Movie/TV search
        ├── n8n.js                # .n8n — n8n workflow templates
        ├── novel.js              # .novel — Novel reader
        ├── search.js             # .search — DuckDuckGo search
        ├── speech.js             # .tts / .voices — Text-to-speech
        ├── unovel.js             # .unovel — Urdu novels
        ├── vision.js             # .vision — AI image analysis
        ├── websnap.js            # .screenshot / .ss — Website screenshot/PDF
        ├── webzip.js             # .zip — Website ZIP archiver
        └── wikipdf.js            # .wikipdf / .wiki — Wikipedia PDF
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js ≥ 18 |
| **Language** | JavaScript (ES Modules) |
| **WhatsApp API** | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) ^6.7.0 |
| **AI Backend** | [Groq SDK](https://console.groq.com) (LLaMA 3.3 70B) |
| **Image Processing** | [Sharp](https://sharp.pixelplumbing.com/) ^0.33.4 |
| **Search** | [ddgs](https://www.npmjs.com/package/ddgs) (DuckDuckGo) |
| **Logging** | [Pino](https://getpino.io/) ^9.0.0 + pino-pretty |
| **Concurrency** | [p-queue](https://www.npmjs.com/package/p-queue) ^8.0.1 |
| **HTTP** | [node-fetch](https://github.com/node-fetch/node-fetch) ^3.3.2 |
| **Media Download** | [yt-dlp](https://github.com/yt-dlp/yt-dlp) (external binary) |
| **API Backend** | Local/self-hosted REST API via `API_BASE_URL` (default `http://127.0.0.1:3000`) |

---

## Setup

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** (ships with Node.js)
- **yt-dlp** — [install instructions](https://github.com/yt-dlp/yt-dlp#installation); must be on `PATH` or set via `YTDLP_PATH`
- **ffmpeg** — optional but recommended for yt-dlp format merging; set path via `FFMPEG_LOCATION`

### Installation

```bash
cd sasti-automation
npm install
```

### Configuration

Copy or edit `.env` with your settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | **Required.** Groq API key for AI chat. Get one at [console.groq.com](https://console.groq.com) |
| `BOT_PREFIX` | `.` | Command prefix for regular users |
| `SELF_PREFIX` | `!!` | Command prefix for bot owner |
| `SESSION_DIR` | `./auth_info_baileys` | WhatsApp auth session directory |
| `ICON_PATH` | `./icon.png` | Watermark/icon image path |
| `SIGNATURE` | `> Sasti Automation` | Footer appended to all messages |
| `LOG_LEVEL` | `info` | Pino log level (trace/debug/info/warn/error/fatal) |
| `MAX_CONCURRENT` | `5` | Max concurrent command executions |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model ID |
| `API_BASE_URL` | `http://127.0.0.1:3000` | Base URL of the local/self-hosted API backend powering most commands |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp binary path/command |
| `FFMPEG_LOCATION` | — | ffmpeg binary path (optional) |
| `DOWNLOAD_MAX_MB` | `50` | Max download size (MB) |
| `DOWNLOAD_TIMEOUT_MS` | `180000` | Download timeout (ms) |
| `DOWNLOAD_DIR` | `./downloads` | Temp download directory |
| `SEARCH_MAX_RESULTS` | `5` | Max search results |
| `SEARCH_TIMEOUT_MS` | `15000` | Search timeout (ms) |
| `LOG_DIR` | `./logs` | Log file directory |

### Run

```bash
# Production
npm start

# Development with file-watch (Node ≥ 18)
npm run dev
```

On first run, a **QR code** appears in the terminal. Open WhatsApp on your phone → **Linked Devices** → **Link a Device** → scan the QR. The session persists in `auth_info_baileys/` for subsequent runs.

---

## Architecture Overview

1. **`index.js`** — entry point; calls `src/bot.js`.
2. **`src/bot.js`** — initializes a Baileys WhatsApp socket with multi-file auth state. Handles connection lifecycle (QR display, reconnect with exponential backoff, health logging every 5 min). Incoming messages are forwarded to the router.
3. **`src/router.js`** — parses the message prefix, performs fuzzy matching on the command name, enforces per-user rate limits (5/10s), and pushes the command to the p-queue for execution.
4. **`src/commands/*.js`** — each file handles one or more related commands. Most commands call the configurable API backend at `API_BASE_URL`; `aibot` calls Groq directly; `search` uses DuckDuckGo; `dl`/`audio` use local yt-dlp.
5. **`src/helpers.js`** — provides uniform send functions (text, image, audio, video, document, react) that all commands use.
6. **`src/signature.js`** — wraps every outgoing message with the configured signature footer.

---

## Dependencies

### Node Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@whiskeysockets/baileys` | ^6.7.0 | WhatsApp Web API (WebSocket) |
| `ddgs` | ^1.0.4 | DuckDuckGo search wrapper |
| `dotenv` | ^16.4.5 | Environment variable loader |
| `groq-sdk` | ^0.3.0 | Groq AI API client |
| `node-fetch` | ^3.3.2 | ESM-compatible HTTP fetch |
| `p-queue` | ^8.0.1 | Concurrency-limited async queue |
| `pino` | ^9.0.0 | Structured JSON logger |
| `pino-pretty` | ^11.0.0 | Pretty-print logs to console |
| `qrcode-terminal` | ^0.12.0 | QR code rendering |
| `sharp` | ^0.33.4 | Image processing (watermark, resize) |

### System Binaries

- **yt-dlp** — required for `.dl` / `.audio` commands
- **ffmpeg** — optional, for yt-dlp format merging

---

## License

MIT
