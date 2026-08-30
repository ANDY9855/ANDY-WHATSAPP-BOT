import fs from 'node:fs/promises';
import { sendImageWithTextFallback } from '../helpers.js';
import { sign, signCaption } from '../signature.js';
import { BOT_PREFIX, ICON_PATH } from '../config.js';

export async function menuCommand({ sock, jid, message, prefix = BOT_PREFIX }) {
  const p = prefix;
  const menu = `============================
    SASTI AUTOMATION
   Your Pocket Assistant
============================

*AVAILABLE COMMANDS*

*AI & Vision*
- \`${p}aibot <question>\` - Ask anything, get AI answer
- \`${p}vision <question>\` - Analyze a replied/sent image

*Text-to-Speech*
- \`${p}tts <text>\` - Convert text to MP3 audio
- \`${p}voices\` - List available voices
- \`${p}tts <voiceIndex> | <text>\` - TTS with specific voice

*Medicine*
- \`${p}med <medicine name>\` - Full medicine info, price, dosage, side effects

*Image Generation*
- \`${p}img <prompt>\` - Generate AI image
- \`${p}img <prompt> | <ratio>\` - Generate with aspect ratio
- \`${p}img bulk <prompt1> | <prompt2>\` - Generate multiple images
- \`${p}i2i <prompt>\` - Transform a replied-to image
- \`${p}i2i <prompt> | <ratio>\` - Transform image with ratio

*Website Tools*
- \`${p}screenshot <url>\` - Capture website screenshot
- \`${p}screenshot <url> | pdf\` - Capture as PDF
- \`${p}zip <url>\` - Archive any website as ZIP
- \`${p}wikipdf <article>\` - Wikipedia article as PDF
- \`${p}wiki <article>\` - Shortcut for Wikipedia PDF

*Certificate*
- \`${p}cert <name> | <date> | <signature> | <details> | <template 1-8>\` - Generate PDF certificate

*Courses*
- \`${p}courses\` - List free premium courses
- \`${p}courses <keyword>\` - Search courses by name

*Movies & TV*
- \`${p}movie <title>\` - Search movies and TV shows

*Media Downloader*
- \`${p}dl <url>\` - Download video/media via yt-dlp
- \`${p}audio <url>\` - Download audio as MP3
- \`${p}alldl <url>\` - Universal download (YT, TikTok, IG, FB, X, etc.)

*Disposable Email*
- \`${p}mail create\` - Generate temp email
- \`${p}mail inbox <email>\` - Check inbox
- \`${p}mail read <email> <id>\` - Read message

*Manga & Novels*
- \`${p}manga search <title>\` - Search manga
- \`${p}manga chapters <id>\` - List chapters
- \`${p}manga pages <chapterId>\` - View pages
- \`${p}novel search <title>\` - Search novels
- \`${p}novel chapters <id>\` - List chapters
- \`${p}novel read <fileUrl> [en|ur]\` - Read chapter
- \`${p}unovel categories\` - Urdu novels categories
- \`${p}unovel search <query>\` - Search Urdu novels
- \`${p}unovel detail <url>\` - Novel details + downloads

*n8n Workflows*
- \`${p}n8n [category] [complexity]\` - Browse automation workflows

*Internet Search*
- \`${p}search <query>\` - Search DuckDuckGo

*Utility*
- \`${p}ping\` - Check if bot is online
- \`${p}menu\` - Show this menu`;

  const signedMenu = sign(menu);
  const icon = await fs.readFile(ICON_PATH);
  await sendImageWithTextFallback(sock, jid, icon, signCaption(menu), signedMenu, { quoted: message });
}
