import { Router } from 'express';
import { sendSuccess } from '../../lib/http';

const router = Router();

/**
 * @openapi
 * /api/evaluation:
 *   get:
 *     tags: [System]
 *     summary: Candidate / submission metadata
 *     responses:
 *       200:
 *         description: Candidate info and feature list
 */
router.get('/evaluation', (_req, res) => {
  sendSuccess(res, {
    candidateName: 'Rithwik Kuchana',
    email: 'rithwikkuchana@gmail.com',
    repositoryUrl: 'https://github.com/imposter29/Hintro-Assignment',
    deployedUrl: 'https://hintro-assignment-inlx.onrender.com',
    externalIntegration: 'Resend Email',
    features: [
      'Authentication',
      'Meeting Management',
      'AI Analysis with Citations',
      'Action Item Management',
      'Overdue Detection',
      'Scheduled Reminders',
      'Email Integration',
    ],
  });
});

export default router;
