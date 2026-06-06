import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';

/**
 * Ensures every request has a trace ID.
 * - Reuses the inbound `x-trace-id` header if present, otherwise generates a UUID.
 * - Stores it on `req.traceId` and `res.locals.traceId` (used by the response helpers).
 * - Echoes it back in the `x-trace-id` response header.
 * - Logs request start and completion with timing.
 */
export function traceId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-trace-id');
  const id = incoming && incoming.trim() !== '' ? incoming : uuidv4();

  req.traceId = id;
  res.locals.traceId = id;
  res.setHeader('x-trace-id', id);

  const start = Date.now();

  logger.info('request received', {
    traceId: id,
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    logger.info('request completed', {
      traceId: id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
