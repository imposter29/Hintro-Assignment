import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';

type Target = 'body' | 'query' | 'params';

/**
 * Returns middleware that validates the given request segment against a Zod
 * schema. On success the parsed (and coerced) value replaces the original.
 * On failure it throws a ZodError, which the global error handler renders as a
 * VALIDATION_ERROR with field-level details.
 */
export function validate(schema: AnyZodObject, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);
      // query/params are read-only getters in some Express versions; assign safely.
      if (target === 'body') {
        req.body = parsed;
      } else {
        Object.assign(req[target], parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(err);
        return;
      }
      next(err);
    }
  };
}
