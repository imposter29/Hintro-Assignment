import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sendReminderEmail } from '../../lib/mailer';

const CHANNEL = 'email';
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RunSummary {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Core reminder logic, decoupled from the cron schedule so it can be triggered
 * manually or in tests.
 *
 * 1. Find overdue action items (not COMPLETED, dueDate in the past).
 * 2. Skip any that already received a reminder in the last 24 hours.
 * 3. Send an email via Resend and log the outcome to ReminderLog.
 */
export async function runReminderSweep(traceId = uuidv4()): Promise<RunSummary> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - DEDUPE_WINDOW_MS);

  const overdue = await prisma.actionItem.findMany({
    where: {
      status: { not: 'COMPLETED' },
      dueDate: { lt: now },
      assignee: { not: '' },
    },
    include: { meeting: { select: { title: true } } },
  });

  const summary: RunSummary = { scanned: overdue.length, sent: 0, skipped: 0, failed: 0 };

  logger.info('reminder sweep started', { traceId, overdueCount: overdue.length });

  for (const item of overdue) {
    // Skip if a reminder was already sent within the dedupe window.
    const recent = await prisma.reminderLog.findFirst({
      where: { actionItemId: item.id, sentAt: { gte: cutoff }, success: true },
      select: { id: true },
    });
    if (recent) {
      summary.skipped += 1;
      continue;
    }

    const recipient = item.assignee;
    const message = `Reminder: ${item.title} (due ${item.dueDate?.toISOString() ?? 'n/a'})`;

    const result = await sendReminderEmail(
      recipient,
      {
        title: item.title,
        assignee: item.assignee,
        dueDate: item.dueDate,
        status: item.status,
        meetingTitle: item.meeting?.title ?? null,
      },
      traceId
    );

    await prisma.reminderLog.create({
      data: {
        actionItemId: item.id,
        channel: CHANNEL,
        recipient,
        message,
        success: result.success,
      },
    });

    if (result.success) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
    }
  }

  logger.info('reminder sweep finished', { traceId, ...summary });
  return summary;
}
