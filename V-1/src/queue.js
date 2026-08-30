import PQueue from 'p-queue';
import { MAX_CONCURRENT } from './config.js';
import logger from './logger.js';

export const queue = new PQueue({ concurrency: MAX_CONCURRENT });

queue.on('active', () => {
  logger.debug({ size: queue.size, pending: queue.pending }, 'Queue active');
});
