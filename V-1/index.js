import 'dotenv/config';
import { startBot } from './src/bot.js';
import logger from './src/logger.js';

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
});

logger.info('Starting BOT_404...');
startBot();
