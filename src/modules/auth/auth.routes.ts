import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { loginSchema, registerSchema } from './auth.schema';
import * as authController from './auth.controller';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Jane Doe }
 *               email: { type: string, example: jane@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       201:
 *         description: User created, returns user and JWT token
 *       409:
 *         description: Email already registered
 */
router.post('/register', validate(registerSchema), asyncHandler(authController.register));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: jane@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       200:
 *         description: Returns user and JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

export default router;
