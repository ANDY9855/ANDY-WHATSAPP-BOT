import { fetchBuffer, fetchJson } from '../http.js';
import { reactTo, sendAudio, sendSignedText, sendVideo } from '../helpers.js';
import logger from '../logger.js';
import { signCaption } from '../signature.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

export async function alldlCommand({ sock, jid, args, message, prefix }) {
  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}alldl <video URL>\nSupports YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit, Snapchat, SoundCloud, CapCut, SnackVideo, Douyin`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');
    await sendSignedText(sock, jid, '⏳ Fetching media info...', { quoted: message });

    const data = await fetchJson(
      `${BASE}/api/alldl?url=${encodeURIComponent(args.trim())}`,
      {},
      30000
    );

    if (!data.success || !data.mediaInfo) {
      await sendSignedText(sock, jid, '❌ Could not fetch media from that URL.', { quoted: message });
      return;
    }

    const info = data.mediaInfo;
    const videoUrl = info.videoUrl || info.qualities?.[0]?.url;
    const audioUrl = info.audioUrl;

    if (!videoUrl && !audioUrl) {
      await sendSignedText(sock, jid, '❌ No downloadable media found.', { quoted: message });
      return;
    }

    const caption = signCaption(
      `⬇️ *${info.title || 'Media Ready!'}*\n📱 Platform: ${info.platform || 'Unknown'}\n🎬 Quality: ${info.qualities?.map((q) => q.quality).join(', ') || 'N/A'}`
    );

    if (audioUrl) {
      try {
        const { buffer } = await fetchBuffer(audioUrl, {}, 120000);
        await sendAudio(sock, jid, buffer, caption, { quoted: message });
        await reactTo(sock, jid, message.key, '✅');
        return;
      } catch {
        logger.warn('Audio download failed, trying video');
      }
    }

    if (videoUrl) {
      try {
        const { buffer } = await fetchBuffer(videoUrl, {}, 120000);
        await sendVideo(sock, jid, buffer, caption, { quoted: message });
      } catch {
        await sendSignedText(sock, jid, `📹 Direct link: ${videoUrl}\n💾 Audio: ${audioUrl || 'N/A'}`, { quoted: message });
      }
    }

    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'AllDL command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ Download failed. The link might be invalid or unsupported.', { quoted: message });
  }
}
