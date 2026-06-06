import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startReminderScheduler, stopReminderScheduler } from './modules/reminders/reminder.scheduler';

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info('server started', {
      port: env.port,
      env: env.nodeEnv,
      docs: `http://localhost:${env.port}/api/docs`,
    });
  });

  // Hourly overdue-reminder cron.
  startReminderScheduler();

  const shutdown = async (signal: string) => {
    logger.info('shutting down', { signal });
    stopReminderScheduler();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('fatal startup error', {
    errorMessage: err instanceof Error ? err.message : 'unknown',
  });
  process.exit(1);
});
