import { Request, Response } from 'express';
import { ActionItemStatus } from '@prisma/client';
import { sendSuccess } from '../../lib/http';
import * as service from './actionItems.service';

export async function create(req: Request, res: Response): Promise<void> {
  const item = await service.createActionItem(req.user!.id, req.body);
  sendSuccess(res, item, 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const items = await service.listActionItems(req.user!.id, {
    status: req.query.status as ActionItemStatus | undefined,
    assignee: req.query.assignee as string | undefined,
    meetingId: req.query.meetingId as string | undefined,
  });
  sendSuccess(res, { items, count: items.length }, 200);
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const item = await service.updateStatus(req.user!.id, req.params.id, req.body.status);
  sendSuccess(res, item, 200);
}

export async function overdue(req: Request, res: Response): Promise<void> {
  const items = await service.getOverdueItems(req.user!.id);
  sendSuccess(res, { items, count: items.length }, 200);
}
