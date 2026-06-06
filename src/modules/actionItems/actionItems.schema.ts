import { z } from 'zod';

export const createActionItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignee: z.string().email('Assignee must be a valid email'),
  dueDate: z.coerce
    .date({ errorMap: () => ({ message: 'dueDate must be a valid date' }) })
    .refine((d) => d.getTime() > Date.now(), 'dueDate must be in the future'),
  meetingId: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], {
    errorMap: () => ({ message: 'status must be one of PENDING, IN_PROGRESS, COMPLETED' }),
  }),
});

export const listActionItemsQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  assignee: z.string().optional(),
  meetingId: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
export type ListActionItemsQuery = z.infer<typeof listActionItemsQuerySchema>;
