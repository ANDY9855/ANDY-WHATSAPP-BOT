import fs from 'node:fs/promises';
import sharp from 'sharp';
import { ICON_PATH } from './config.js';
import logger from './logger.js';

export async function watermarkImage(imageBuffer) {
  try {
    const iconBuffer = await fs.readFile(ICON_PATH);
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 512;
    const height = metadata.height ?? 512;
    const iconSize = Math.max(48, Math.min(80, Math.floor(Math.min(width, height) * 0.16)));
    const icon = await sharp(iconBuffer)
      .resize(iconSize, iconSize, { fit: 'inside' })
      .png()
      .toBuffer();

    return sharp(imageBuffer)
      .composite([
        {
          input: icon,
          left: Math.max(0, width - iconSize - 10),
          top: Math.max(0, height - iconSize - 10)
        }
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error) {
    logger.error({ error }, 'Image watermarking failed');
    throw new Error('Unable to watermark image. Make sure icon.png exists and is a valid image.');
  }
}
