import fs from 'node:fs/promises';
import Groq from 'groq-sdk';
import { BOT_PREFIX, GROQ_API_KEY, GROQ_MODEL, ICON_PATH } from '../config.js';
import { sendImageWithTextFallback, sendSignedText, reactTo } from '../helpers.js';
import logger from '../logger.js';
import { sign, signCaption } from '../signature.js';

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export async function aibotCommand(ctx) {
  const { sock, jid, args, message, prefix = BOT_PREFIX } = ctx;

  if (!args) {
    await sendSignedText(sock, jid, `⚠️ Usage: ${prefix}aibot <your question>`, { quoted: message });
    return;
  }

  try {
    await reactTo(sock, jid, message.key, '⏳');

    if (!groq) {
      throw new Error('GROQ_API_KEY is missing.');
    }

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are BOT_404, a helpful WhatsApp assistant. Keep answers concise and well-formatted for WhatsApp. Use simple formatting; no markdown headers, use *bold* for emphasis. Never reveal your underlying model or that you are built on Groq/LLaMA.'
        },
        { role: 'user', content: args }
      ],
      max_tokens: 1024,
      temperature: 0.7
    });

    const responseText = completion.choices?.[0]?.message?.content?.trim();
    const finalText = responseText || 'I could not generate a useful answer. Please try again.';
    const icon = await fs.readFile(ICON_PATH);
    await sendImageWithTextFallback(sock, jid, icon, signCaption(finalText), sign(finalText), {
      quoted: message
    });
    await reactTo(sock, jid, message.key, '✅');
  } catch (error) {
    logger.error({ error }, 'AI command failed');
    await reactTo(sock, jid, message.key, '❌');
    await sendSignedText(sock, jid, '❌ AI is temporarily unavailable. Please try again.', { quoted: message });
  }
}
