import { z } from 'zod';

const transcriptEntrySchema = z.object({
  timestamp: z.string().min(1, 'timestamp is required'),
  speaker: z.string().min(1, 'speaker is required'),
  text: z.string().min(1, 'text is required'),
});

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  participants: z.array(z.string().email('Each participant must be a valid email')),
  meetingDate: z.coerce.date({ errorMap: () => ({ message: 'meetingDate must be a valid date' }) }),
  transcript: z.array(transcriptEntrySchema).min(1, 'Transcript must contain at least one entry'),
});

export const listMeetingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
