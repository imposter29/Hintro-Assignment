import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendError } from '../lib/http';

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
}

/**
 * Verifies a JWT from the `Authorization: Bearer <token>` header.
 * Attaches the decoded user to `req.user`. Responds 401 when missing/invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');

  if (!header || !header.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}
