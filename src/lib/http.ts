import { Response } from 'express';

/** Standard success envelope. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({
    traceId: res.locals.traceId,
    success: true,
    data,
  });
}

interface ErrorDetail {
  field: string;
  message: string;
}

/** Standard error envelope. */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetail[]
): Response {
  return res.status(statusCode).json({
    traceId: res.locals.traceId,
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

/**
 * Application-level error with an HTTP status and machine-readable code.
 * Thrown by services/controllers and translated by the global error handler.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}
