import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError, sendError } from '../lib/http';
import { logger } from '../lib/logger';
import { isProduction } from '../config/env';

/**
 * Centralised error handler. Translates known error types into the standard
 * error envelope; never leaks stack traces in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    logger.warn('validation error', {
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl,
      details,
    });
    sendError(res, 400, 'VALIDATION_ERROR', 'Validation failed', details);
    return;
  }

  // Application errors
  if (err instanceof AppError) {
    logger.warn('application error', {
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl,
      code: err.code,
      statusCode: err.statusCode,
      errorMessage: err.message,
    });
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // JWT errors (in case they surface outside the auth middleware)
  if (err instanceof TokenExpiredError) {
    sendError(res, 401, 'UNAUTHORIZED', 'Token expired');
    return;
  }
  if (err instanceof JsonWebTokenError) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      sendError(res, 409, 'CONFLICT', `A record with this ${target} already exists`);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'The requested record was not found');
      return;
    }
    logger.error('prisma error', {
      traceId: req.traceId,
      code: err.code,
      errorMessage: err.message,
    });
    sendError(res, 400, 'DATABASE_ERROR', 'A database error occurred');
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'DATABASE_ERROR', 'Invalid database query');
    return;
  }

  // Fallback — unknown / unexpected error
  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('unhandled error', {
    traceId: req.traceId,
    method: req.method,
    path: req.originalUrl,
    errorMessage: message,
    stack: isProduction ? undefined : stack,
  });

  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    isProduction ? 'An unexpected error occurred' : message
  );
}

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}
