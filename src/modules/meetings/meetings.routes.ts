import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createMeetingSchema,
  idParamSchema,
  listMeetingsQuerySchema,
} from './meetings.schema';
import * as meetingsController from './meetings.controller';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/meetings:
 *   post:
 *     tags: [Meetings]
 *     summary: Create a meeting
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, participants, meetingDate, transcript]
 *             properties:
 *               title: { type: string, example: Q3 Planning }
 *               participants:
 *                 type: array
 *                 items: { type: string, format: email }
 *                 example: ["jane@example.com", "john@example.com"]
 *               meetingDate: { type: string, format: date-time, example: "2026-06-01T10:00:00Z" }
 *               transcript:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     timestamp: { type: string, example: "00:10" }
 *                     speaker: { type: string, example: Jane }
 *                     text: { type: string, example: "Let's ship the API by Friday." }
 *     responses:
 *       201: { description: Meeting created }
 *   get:
 *     tags: [Meetings]
 *     summary: List meetings (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated list of meetings }
 */
router.post('/', validate(createMeetingSchema), asyncHandler(meetingsController.create));
router.get('/', validate(listMeetingsQuerySchema, 'query'), asyncHandler(meetingsController.list));

/**
 * @openapi
 * /api/meetings/{id}:
 *   get:
 *     tags: [Meetings]
 *     summary: Get a single meeting (with analysis and action items)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Meeting found }
 *       404: { description: Meeting not found }
 */
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(meetingsController.getById));

/**
 * @openapi
 * /api/meetings/{id}/analyze:
 *   post:
 *     tags: [Meetings]
 *     summary: Run AI analysis on a meeting transcript
 *     description: Uses Groq (llama-3.3-70b-versatile) to produce a cited summary, action items, decisions, and follow-ups. Persists the analysis and creates PENDING action items.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Analysis created }
 *       404: { description: Meeting not found }
 */
router.post(
  '/:id/analyze',
  validate(idParamSchema, 'params'),
  asyncHandler(meetingsController.analyze)
);

export default router;
