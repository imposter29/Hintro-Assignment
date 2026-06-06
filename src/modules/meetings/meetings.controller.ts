import { Request, Response } from 'express';
import { sendSuccess } from '../../lib/http';
import * as meetingsService from './meetings.service';

export async function create(req: Request, res: Response): Promise<void> {
  const meeting = await meetingsService.createMeeting(req.user!.id, req.body);
  sendSuccess(res, meeting, 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await meetingsService.listMeetings(req.user!.id, page, limit);
  sendSuccess(res, result, 200);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const meeting = await meetingsService.getMeeting(req.user!.id, req.params.id);
  sendSuccess(res, meeting, 200);
}

export async function analyze(req: Request, res: Response): Promise<void> {
  const result = await meetingsService.analyzeMeeting(req.user!.id, req.params.id, req.traceId);
  sendSuccess(res, result, 201);
}
