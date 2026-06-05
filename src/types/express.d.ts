import 'express';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export {};
