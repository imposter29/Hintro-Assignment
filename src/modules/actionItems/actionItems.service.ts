import { ActionItemStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/http';
import { CreateActionItemInput, ListActionItemsQuery } from './actionItems.schema';

export async function createActionItem(userId: string, input: CreateActionItemInput) {
  // If a meetingId is supplied, ensure it belongs to the user.
  if (input.meetingId) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: input.meetingId, userId },
      select: { id: true },
    });
    if (!meeting) {
      throw new AppError(404, 'NOT_FOUND', 'Linked meeting not found');
    }
  }

  return prisma.actionItem.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee,
      dueDate: input.dueDate,
      status: 'PENDING',
      meetingId: input.meetingId ?? null,
      userId,
      citations: Prisma.JsonNull,
    },
  });
}

export async function listActionItems(userId: string, filters: ListActionItemsQuery) {
  return prisma.actionItem.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status as ActionItemStatus } : {}),
      ...(filters.assignee ? { assignee: filters.assignee } : {}),
      ...(filters.meetingId ? { meetingId: filters.meetingId } : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: { meeting: { select: { id: true, title: true } } },
  });
}

export async function updateStatus(userId: string, id: string, status: ActionItemStatus) {
  const existing = await prisma.actionItem.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Action item not found');
  }

  return prisma.actionItem.update({
    where: { id },
    data: { status },
  });
}

/**
 * Overdue = not COMPLETED and dueDate strictly before now.
 */
export async function getOverdueItems(userId: string) {
  return prisma.actionItem.findMany({
    where: {
      userId,
      status: { not: 'COMPLETED' },
      dueDate: { lt: new Date() },
    },
    orderBy: { dueDate: 'asc' },
    include: { meeting: { select: { id: true, title: true } } },
  });
}
