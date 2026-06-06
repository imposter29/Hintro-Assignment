import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from './logger';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!env.resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!resend) {
    resend = new Resend(env.resendApiKey);
  }
  return resend;
}

/** Shape of the action item needed to compose a reminder email. */
export interface ReminderActionItem {
  title: string;
  assignee: string;
  dueDate: Date | null;
  status: string;
  meetingTitle?: string | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function buildBody(item: ReminderActionItem): string {
  const due = item.dueDate ? item.dueDate.toISOString() : 'No due date';
  const lines = [
    `Task: ${item.title}`,
    `Assigned To: ${item.assignee}`,
    `Due Date: ${due}`,
    `Status: ${item.status}`,
  ];
  if (item.meetingTitle) {
    lines.push(`Meeting: ${item.meetingTitle}`);
  }
  return lines.join('\n');
}

/**
 * Send an overdue-action-item reminder via Resend.
 * Returns a structured result instead of throwing so callers can log failures.
 */
export async function sendReminderEmail(
  to: string,
  item: ReminderActionItem,
  traceId?: string
): Promise<SendResult> {
  const subject = `Reminder: ${item.title}`;
  const text = buildBody(item);

  try {
    const { data, error } = await getResend().emails.send({
      from: env.resendFromEmail,
      to,
      subject,
      text,
    });

    if (error) {
      logger.error('Resend returned an error', { traceId, error: error.message, recipient: to });
      return { success: false, error: error.message };
    }

    logger.info('Reminder email sent', { traceId, recipient: to, messageId: data?.id });
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown mailer error';
    logger.error('Failed to send reminder email', { traceId, error: message, recipient: to });
    return { success: false, error: message };
  }
}
