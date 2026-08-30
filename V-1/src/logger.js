import fs from 'node:fs';
import pino from 'pino';
import { LOG_DIR, LOG_LEVEL } from './config.js';

fs.mkdirSync(LOG_DIR, { recursive: true });

const streams = [
  { stream: process.stdout },
  {
    stream: pino.destination({
      dest: `${LOG_DIR}/bot.log`,
      mkdir: true,
      sync: false
    })
  }
];

const logger = pino(
  {
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime
  },
  pino.multistream(streams)
);

export default logger;
