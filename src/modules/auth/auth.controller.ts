import { Request, Response } from 'express';
import { sendSuccess } from '../../lib/http';
import * as authService from './auth.service';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  sendSuccess(res, result, 200);
}
