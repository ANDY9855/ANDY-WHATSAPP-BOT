import path from 'node:path';

const numberFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const BOT_PREFIX = process.env.BOT_PREFIX || '.';
export const SELF_PREFIX = process.env.SELF_PREFIX || '!!';
export const SESSION_DIR = process.env.SESSION_DIR || './auth_info_baileys';
export const ICON_PATH = process.env.ICON_PATH || './icon.png';
export const SIGNATURE = process.env.SIGNATURE || '> BOT_404';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const MAX_CONCURRENT = numberFromEnv('MAX_CONCURRENT', 5);
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
export const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
export const LOG_DIR = process.env.LOG_DIR || './logs';
export const HEALTH_LOG_PATH = path.join(LOG_DIR, 'health.log');
export const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || './downloads';
export const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
export const FFMPEG_LOCATION = process.env.FFMPEG_LOCATION || '';
export const DOWNLOAD_MAX_MB = numberFromEnv('DOWNLOAD_MAX_MB', 50);
export const DOWNLOAD_TIMEOUT_MS = numberFromEnv('DOWNLOAD_TIMEOUT_MS', 180000);
export const SEARCH_MAX_RESULTS = numberFromEnv('SEARCH_MAX_RESULTS', 5);
export const SEARCH_TIMEOUT_MS = numberFromEnv('SEARCH_TIMEOUT_MS', 15000);
export const OWNER_JID = process.env.OWNER_JID || '';
