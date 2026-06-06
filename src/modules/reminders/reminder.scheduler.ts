import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { runReminderSweep } from './reminder.service';

// Run at the top of every hour.
const SCHEDULE = '0 * * * *';

let task: ScheduledTask | null = null;

/**
 * Register the hourly reminder cron job. The sweep is skipped (with a warning)
 * when Resend is not configured, so the server still boots in dev without keys.
 */
export function startReminderScheduler(): void {
  if (task) {
    return;
  }

  task = cron.schedule(SCHEDULE, async () => {
    const traceId = uuidv4();
    if (!env.resendApiKey) {
      logger.warn('reminder sweep skipped: RESEND_API_KEY not configured', { traceId });
      return;
    }
    try {
      await runReminderSweep(traceId);
    } catch (err) {
      logger.error('reminder sweep crashed', {
        traceId,
        errorMessage: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  logger.info('reminder scheduler started', { schedule: SCHEDULE });
}

export function stopReminderScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
