import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DOWNLOAD_DIR,
  DOWNLOAD_MAX_MB,
  DOWNLOAD_TIMEOUT_MS,
  FFMPEG_LOCATION,
  YTDLP_PATH
} from './config.js';

const SUPPORTED_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export function normalizeMediaUrl(input) {
  const trimmed = input.trim();
  if (!SUPPORTED_URL_PATTERN.test(trimmed)) {
    throw new Error('Please send a valid http:// or https:// media URL.');
  }
  return new URL(trimmed).toString();
}

function createArgs(url, mode, workDir) {
  const args = [
    '--no-playlist',
    '--max-filesize',
    `${DOWNLOAD_MAX_MB}M`,
    '--socket-timeout',
    '20',
    '--retries',
    '2',
    '--no-warnings',
    '--restrict-filenames',
    '-o',
    path.join(workDir, 'download.%(ext)s')
  ];

  if (FFMPEG_LOCATION) {
    args.push('--ffmpeg-location', FFMPEG_LOCATION);
  }

  if (mode === 'audio') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '5');
  } else {
    args.push(
      '-f',
      `bv*[ext=mp4][filesize<${DOWNLOAD_MAX_MB}M]+ba[ext=m4a]/b[ext=mp4][filesize<${DOWNLOAD_MAX_MB}M]/best[filesize<${DOWNLOAD_MAX_MB}M]/best`,
      '--merge-output-format',
      'mp4'
    );
  }

  args.push(url);
  return args;
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(YTDLP_PATH, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Download timed out after ${Math.round(DOWNLOAD_TIMEOUT_MS / 1000)} seconds.`));
    }, DOWNLOAD_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      if (error.code === 'ENOENT') {
        reject(new Error('yt-dlp was not found. Install yt-dlp and ffmpeg, then try again.'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const output = `${stderr || stdout}`.trim();
      reject(new Error(output || `yt-dlp exited with code ${code}`));
    });
  });
}

function mimetypeFor(filePath, mode) {
  const ext = path.extname(filePath).toLowerCase();
  if (mode === 'audio' || ext === '.mp3') return 'audio/mpeg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

export async function downloadMedia(url, mode = 'video') {
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  const workDir = await fs.mkdtemp(path.join(DOWNLOAD_DIR, `job-${Date.now()}-`));

  try {
    const args = createArgs(url, mode, workDir);
    await runYtDlp(args);
    const files = await fs.readdir(workDir);
    const fileName = files.find((file) => !file.endsWith('.part') && !file.endsWith('.ytdl'));

    if (!fileName) {
      throw new Error('Download finished but no media file was created.');
    }

    const filePath = path.join(workDir, fileName);
    const stats = await fs.stat(filePath);
    const maxBytes = DOWNLOAD_MAX_MB * 1024 * 1024;

    if (stats.size > maxBytes) {
      throw new Error(`Downloaded file is larger than ${DOWNLOAD_MAX_MB} MB.`);
    }

    const buffer = await fs.readFile(filePath);
    return {
      buffer,
      fileName,
      mimetype: mimetypeFor(filePath, mode),
      sizeBytes: stats.size,
      cleanup: () => fs.rm(workDir, { recursive: true, force: true })
    };
  } catch (error) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
