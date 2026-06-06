import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { traceId } from './middleware/traceId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sendSuccess } from './lib/http';
import { swaggerSpec } from './config/swagger';

import authRoutes from './modules/auth/auth.routes';
import meetingsRoutes from './modules/meetings/meetings.routes';
import actionItemsRoutes from './modules/actionItems/actionItems.routes';
import systemRoutes from './modules/system/system.routes';

export function createApp(): Application {
  const app = express();

  // CORS for all origins.
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(traceId);

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [System]
   *     summary: Health check
   *     responses:
   *       200:
   *         description: Service is up
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
  });

  // Swagger docs — public, no auth.
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  // API routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/meetings', meetingsRoutes);
  app.use('/api/action-items', actionItemsRoutes);
  app.use('/api', systemRoutes);

  // Friendly root.
  app.get('/', (_req: Request, res: Response) => {
    sendSuccess(res, {
      service: 'Meeting Intelligence Service',
      docs: '/api/docs',
      health: '/health',
    });
  });

  // 404 + error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
