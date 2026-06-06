import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createActionItemSchema,
  idParamSchema,
  listActionItemsQuerySchema,
  updateStatusSchema,
} from './actionItems.schema';
import * as controller from './actionItems.controller';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/action-items:
 *   post:
 *     tags: [Action Items]
 *     summary: Create an action item
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, assignee, dueDate]
 *             properties:
 *               title: { type: string, example: Ship the API }
 *               description: { type: string, example: Finish endpoints and deploy }
 *               assignee: { type: string, format: email, example: jane@example.com }
 *               dueDate: { type: string, format: date-time, example: "2026-12-31T17:00:00Z" }
 *               meetingId: { type: string, nullable: true }
 *     responses:
 *       201: { description: Action item created }
 *   get:
 *     tags: [Action Items]
 *     summary: List action items with optional filters
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, IN_PROGRESS, COMPLETED] }
 *       - in: query
 *         name: assignee
 *         schema: { type: string }
 *       - in: query
 *         name: meetingId
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of action items }
 */
router.post('/', validate(createActionItemSchema), asyncHandler(controller.create));
router.get('/', validate(listActionItemsQuerySchema, 'query'), asyncHandler(controller.list));

/**
 * @openapi
 * /api/action-items/overdue:
 *   get:
 *     tags: [Action Items]
 *     summary: List overdue action items (not completed and past due)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of overdue action items }
 */
router.get('/overdue', asyncHandler(controller.overdue));

/**
 * @openapi
 * /api/action-items/{id}/status:
 *   patch:
 *     tags: [Action Items]
 *     summary: Update the status of an action item
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [PENDING, IN_PROGRESS, COMPLETED] }
 *     responses:
 *       200: { description: Updated action item }
 *       404: { description: Action item not found }
 */
router.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  validate(updateStatusSchema),
  asyncHandler(controller.updateStatus)
);

export default router;
