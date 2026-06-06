import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/http';
import { logger } from '../../lib/logger';
import { analyzeTranscript, TranscriptEntry } from '../../lib/groq';
import { CreateMeetingInput } from './meetings.schema';

export async function createMeeting(userId: string, input: CreateMeetingInput) {
  return prisma.meeting.create({
    data: {
      title: input.title,
      participants: input.participants,
      meetingDate: input.meetingDate,
      transcript: input.transcript as unknown as Prisma.InputJsonValue,
      userId,
    },
  });
}

export async function listMeetings(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId },
      orderBy: { meetingDate: 'desc' },
      skip,
      take: limit,
      include: { analysis: { select: { id: true, createdAt: true } } },
    }),
    prisma.meeting.count({ where: { userId } }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getMeeting(userId: string, meetingId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
    include: { analysis: true, actionItems: true },
  });

  if (!meeting) {
    throw new AppError(404, 'NOT_FOUND', 'Meeting not found');
  }
  return meeting;
}

/**
 * Run AI analysis over a meeting transcript, persist the MeetingAnalysis,
 * and create ActionItem records (status PENDING) from the analysis output.
 */
export async function analyzeMeeting(userId: string, meetingId: string, traceId: string) {
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId } });
  if (!meeting) {
    throw new AppError(404, 'NOT_FOUND', 'Meeting not found');
  }

  const transcript = meeting.transcript as unknown as TranscriptEntry[];
  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new AppError(400, 'INVALID_TRANSCRIPT', 'Meeting has no transcript to analyze');
  }

  const analysis = await analyzeTranscript(
    transcript,
    {
      title: meeting.title,
      participants: meeting.participants,
      meetingDate: meeting.meetingDate,
    },
    traceId
  );

  // Persist analysis + derived action items atomically.
  const result = await prisma.$transaction(async (tx) => {
    const saved = await tx.meetingAnalysis.upsert({
      where: { meetingId },
      create: {
        meetingId,
        summary: analysis.summary as unknown as Prisma.InputJsonValue,
        actionItems: analysis.actionItems as unknown as Prisma.InputJsonValue,
        decisions: analysis.decisions as unknown as Prisma.InputJsonValue,
        followUpSuggestions: analysis.followUpSuggestions as unknown as Prisma.InputJsonValue,
      },
      update: {
        summary: analysis.summary as unknown as Prisma.InputJsonValue,
        actionItems: analysis.actionItems as unknown as Prisma.InputJsonValue,
        decisions: analysis.decisions as unknown as Prisma.InputJsonValue,
        followUpSuggestions: analysis.followUpSuggestions as unknown as Prisma.InputJsonValue,
      },
    });

    const createdItems = [];
    for (const ai of analysis.actionItems) {
      const due = ai.dueDate ? new Date(ai.dueDate) : null;
      const item = await tx.actionItem.create({
        data: {
          title: ai.task,
          description: null,
          assignee: ai.assignee && ai.assignee.trim() !== '' ? ai.assignee : 'unassigned',
          dueDate: due && !isNaN(due.getTime()) ? due : null,
          status: 'PENDING',
          meetingId,
          userId,
          citations: ai.citations as unknown as Prisma.InputJsonValue,
        },
      });
      createdItems.push(item);
    }

    return { analysis: saved, actionItems: createdItems };
  });

  logger.info('meeting analyzed', {
    traceId,
    meetingId,
    actionItemsCreated: result.actionItems.length,
  });

  return result;
}
