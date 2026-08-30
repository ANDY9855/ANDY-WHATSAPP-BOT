# API Backend Documentation

> **Base URL:** `http://127.0.0.1:3000` by default — set `API_BASE_URL` in `.env` to point the bot at your local/self-hosted API backend (e.g. `http://127.0.0.1:3000/api`).  
> **Authentication:** None required on the default local setup. Secure any public deployment yourself.  
> **Fair Use:** Please do not make excessive automated requests on shared infrastructure.

---

## Table of Contents

1. [WebSnap — Website Screenshot API](#websnap--website-screenshot-api)
2. [SpeechSter — Text-to-Speech API](#speechster--text-to-speech-api)
3. [Universal Downloader — Video Download API](#universal-downloader--video-download-api)
4. [VisionChat — AI Image Analysis API](#visionchat--ai-image-analysis-api)
5. [TempSter — Disposable Email API](#tempster--disposable-email-api)
6. [MangaSter — Free Manga Reader API](#mangaster--free-manga-reader-api)
7. [NovelSter — Novel Reader API](#novelster--novel-reader-api)
8. [UNovelSter — Urdu Novels Library API](#unovelster--urdu-novels-library-api)
9. [PixelSter — AI Image & Video Generation API](#pixelster--ai-image-and-video-generation-api)
10. [CineSearch — Movies & TV Shows API](#cinesearch--movies-and-tv-shows-api)
11. [MEDSTER — Medicine Database API](#medster--medicine-database-api)
12. [WebZip — Website Archive API](#webzip--website-archive-api)
13. [Wikster — Wikipedia to PDF API](#wikster--wikipedia-to-pdf-api)
14. [CertSter — Certificate Generator API](#certster--certificate-generator-api)
15. [n8nSter — n8n Workflow Explorer API](#n8nster--n8n-workflow-explorer-api)
16. [Courses — Tech Courses Catalog API](#courses--tech-courses-catalog-api)

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 400  | Bad request — missing or invalid parameter |
| 404  | Endpoint not found |
| 429  | Too many requests — slow down |
| 500  | Internal server error — report to us |

---

## WebSnap — Website Screenshot API

**Endpoint:** `GET /api/websnap`

Capture any URL as a full-page PNG screenshot or PDF. Returns binary image data.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The URL to screenshot. Must be URL-encoded. |
| `format` | string | No | Output format: png (default) or pdf |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/websnap?url=https://github.com" --output screenshot.png
```

**Notes:** Returns binary image data (PNG or PDF).

---

## SpeechSter — Text-to-Speech API

**Endpoint:** `GET /api/tts`

Convert any text to natural-sounding audio. Returns MP3 binary data.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The text to convert to speech. URL-encode the value. |
| `voice` | string | No | Voice identifier, e.g. en-US, en-GB |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/tts?text=Hello+World&voice=en-US" --output audio.mp3
```

**Notes:** Returns binary MP3 audio.

---

## Universal Downloader — Video Download API

**Endpoint:** `GET /api/alldl`

Download video from any supported platform (YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Snapchat, SoundCloud, CapCut, SnackVideo, Douyin). Returns download URL or binary stream.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Video URL from supported platform. URL-encoded. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/alldl?url=YOUR_VIDEO_URL"
```

### Response Example

```json
{
  "success": true,
  "mediaInfo": {
    "title": "Video Title",
    "platform": "YouTube",
    "videoUrl": "https://...",
    "audioUrl": "https://...",
    "thumbnail": "https://...",
    "qualities": [
      {
        "quality": "720p",
        "url": "https://..."
      }
    ]
  }
}
```

**Notes:** Supports 11 platforms. TikTok and CapCut watermarks are automatically removed.

---

## VisionChat — AI Image Analysis API

**Endpoint:** `POST /api/chat`

Upload an image and ask a question. Returns AI-generated text analysis, OCR, or object description. Supports multi-turn conversations.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | string | Yes | Base64 data URL — data:image/jpeg;base64,... |
| `userPrompt` | string | Yes | The question or instruction about the image |
| `messages` | array | No | Previous turns for multi-turn chat. Each item: { type: 'user'|'ai', content: '...' } |

### cURL Example

```bash
curl -X POST http://127.0.0.1:3000/api/chat -H 'Content-Type: application/json' -d '{"image":"data:image/jpeg;base64,...","userPrompt":"What is in this image?"}'
```

### Response Example

```json
{
  "success": true,
  "response": "The image shows a golden retriever..."
}
```

**Notes:** Image must be a data:image/... base64 data URL. Max recommended size ~10MB before encoding. Supported: JPEG, PNG, WEBP, GIF.

---

## TempSter — Disposable Email API

**Endpoint:** `GET /api/mail`

Generate a disposable email address and poll for incoming messages.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | create | inbox | read | delete |
| `name` | string | No | Custom local-part (optional). Used with action=create. |
| `mail` | string | No | Disposable address. Required for action=inbox, read, delete. |
| `id` | string | No | Message ID. Required for action=read and action=delete. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/mail?action=create"
```

**Notes:** action=create generates a new address. action=inbox lists messages. action=read fetches one message. action=delete removes one message.

---

## MangaSter — Free Manga Reader API

**Endpoint:** `GET /api/manga`

Search manga, get chapters, fetch page images. Thousands of titles updated daily.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | search | chapters | pages |
| `q` | string | No | Search keyword. Required when action=search. |
| `id` | string | No | Manga or chapter ID. Required for action=chapters and action=pages. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/manga?action=search&q=naruto"
```

### Response Example

```json
{
  "success": true,
  "results": [
    {
      "name": "Naruto",
      "cover": "https://...",
      "sourceId": "naruto"
    }
  ]
}
```

**Notes:** Full flow: search → chapters (using sourceId) → pages (using chapterId).

---

## NovelSter — Novel Reader API

**Endpoint:** `GET /api/novel`

Search novels, get chapters, fetch chapter content with English and Urdu translation support.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | search | chapters | read |
| `q` | string | No | Search keyword. Required when action=search. |
| `novelId` | string | No | Novel ID. Required when action=chapters. |
| `fileUrl` | string | No | Chapter file URL. Required when action=read. |
| `lang` | string | No | en or ur for translation. Optional with action=read. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/novel?action=search&q=keyword"
```

**Notes:** Supports English and Urdu translations via lang parameter.

---

## UNovelSter — Urdu Novels Library API

**Endpoint:** `GET /api/unovel`

Browse and search thousands of Urdu novels by category, series, author. Get detail with PDF download links and YouTube audio links.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | categories | series | authors | search | novels | detail |
| `q` | string | No | Search query. Required when action=search. |
| `url` | string | No | URL-encoded novel or category page URL. Required for action=novels and action=detail. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/unovel?action=categories"
```

### Response Example

```json
{
  "ok": true,
  "metadata": {
    "Author": "...",
    "Category": "..."
  },
  "downloadLinks": [
    {
      "text": "Download PDF",
      "url": "https://...",
      "type": "drive"
    }
  ],
  "youtubeLinks": [
    {
      "text": "Part 1",
      "url": "https://youtube.com/...",
      "subtype": "video"
    }
  ],
  "totalLinks": 3
}
```

**Notes:** Returns metadata, downloadLinks (Google Drive/direct PDF), and youtubeLinks (video/playlist).

---

## PixelSter — AI Image & Video Generation API

**Endpoint:** `GET /api/pixel`

Generate AI images and videos from text prompts. Bulk creative workflows.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text prompt for image/video generation. |
| `type` | string | No | image or video. Default: image. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/pixel?prompt=a+cat+in+space"
```

**Notes:** Returns generated media URL or binary. Supports bulk workflows.

---

## CineSearch — Movies & TV Shows API

**Endpoint:** `GET /api/cine`

Search movies and TV shows — ratings, cast, trailers, full metadata.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Movie or TV show title to search. |
| `type` | string | No | movie or tv. Default: movie. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/cine?q=inception"
```

**Notes:** Returns ratings, cast, trailers, and full metadata.

---

## MEDSTER — Medicine Database API

**Endpoint:** `GET /api/search, GET /api/details`

Medicine database — uses, dosage, side effects, price information.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Medicine name to search. Required for /api/search. |
| `id` | string | Yes | The id field from /api/search. Required for /api/details. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/search?q=panadol"
```

### Response Example

```json
{
  "success": true,
  "query": "panadol",
  "count": 2,
  "results": [
    {
      "id": "panadol-500mg-tab-200-s",
      "name": "Panadol 500mg Tab 200's",
      "price": "Rs. 36.0"
    }
  ]
}
```

**Notes:** Two-step flow: /api/search to find medicines, then /api/details?id=... for full pharmaceutical details.

---

## WebZip — Website Archive API

**Endpoint:** `POST /api/zip`

Archive any website as a ZIP file. Backup, mirror, and preserve assets.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Full URL to archive. |

### cURL Example

```bash
curl -X POST http://127.0.0.1:3000/api/zip -H "Content-Type: application/json" -d '{"url":"https://example.com"}' --output site.zip
```

**Notes:** Takes 10–75s. Filename is set automatically. Returns ZIP binary.

---

## Wikster — Wikipedia to PDF API

**Endpoint:** `GET /api/wikster`

Convert any Wikipedia article into a beautifully formatted PDF.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Wikipedia article title or URL. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/wikster?q=Artificial_intelligence" --output article.pdf
```

**Notes:** Returns PDF binary.

---

## CertSter — Certificate Generator API

**Endpoint:** `GET /api/certificate?action=templates, POST /api/certificate`

Generate professional certificates with custom names, titles and dates. 8 templates available.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | No | templates — returns list of available templates. |
| `name` | string | Yes | Recipient's full name. |
| `date` | string | Yes | Date shown on the certificate. |
| `signature` | string | Yes | Signing authority name. |
| `details` | string | Yes | Body text / reason for the certificate. |
| `templateId` | number | Yes | Template number 1–8. |
| `format` | string | No | pdf (default), jpg, or png. |
| `returnUrl` | boolean | No | If true, returns JSON with render URL instead of file stream. |

### cURL Example

```bash
curl -X POST http://127.0.0.1:3000/api/certificate -H "Content-Type: application/json" -d '{"name":"Ayesha Khan","date":"01/01/2025","signature":"Dr. Smith","details":"Completion","templateId":1}' --output certificate.pdf
```

### Response Example

```json
{
  "success": true,
  "renderUrl": "https://...",
  "template": "Modern",
  "format": "pdf",
  "fields": {
    "name": "Ayesha Khan",
    "date": "01/01/2025",
    "signature": "Dr. Smith"
  }
}
```

**Notes:** GET for templates list. POST streams file directly (3–8s). Filename auto-set to Certificate_<Name>_<Template>-certificate.pdf.

---

## n8nSter — n8n Workflow Explorer API

**Endpoint:** `GET /api/n8n`

Browse and search thousands of n8n automation workflows.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `endpoint` | string | Yes | templates |
| `category` | string | No | Filter by category name or slug (e.g., ai-automation). |
| `complexity` | string | No | Simple, Medium, or Complex. |
| `triggerType` | string | No | Manual, Scheduled, Triggered, or Webhook. |
| `page` | number | No | Pagination page number. Default: 1. |
| `limit` | number | No | Items per page. Default: 20. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/n8n?endpoint=templates&category=ai-automation&complexity=Complex"
```

### Response Example

```json
{
  "templates": [
    {
      "id": "1599_webhook_automation",
      "name": "WooCommerce Webhook Process Pipeline",
      "description": "Automated workflow handler mapping transaction triggers.",
      "category": "Woocommercetool",
      "complexity": "Complex",
      "triggerType": "Webhook",
      "nodeCount": 25,
      "downloadUrl": "https://...",
      "githubPath": "https://github.com/..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 538
  }
}
```

**Notes:** Filter parameters can be stacked. Returns workflow templates with downloadUrl and githubPath.

---

## Courses — Tech Courses Catalog API

**Endpoint:** `GET /api/courses`

2025 tech courses catalog with REST API — filter, search, integrate.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search/filter by course name. |

### cURL Example

```bash
curl "http://127.0.0.1:3000/api/courses"
```

### Response Example

```json
{
  "success": true,
  "title": "Tech Courses 2026",
  "total": 17,
  "count": 17,
  "courses": [
    {
      "id": 1,
      "name": "\ud83c\udf89 YouTube Automation Course By Huzaifa \u2764",
      "url": "https://drive.google.com/drive/folders/..."
    }
  ]
}
```

**Notes:** Returns course catalog with Google Drive links.

---

## About this API

This is the local/self-hosted API backend the bot talks to. Deploy or run it on your own machine, then set `API_BASE_URL` in the bot's `.env` to point at it. No remote service or hosted credentials are required.
