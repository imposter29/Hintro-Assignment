import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/http';
import { env } from '../../config/env';
import { LoginInput, RegisterInput } from './auth.schema';

const SALT_ROUNDS = 10;

function signToken(user: { id: string; email: string; name: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
  );
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'An account with this email already exists');
  }

  const hashed = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password: hashed },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signToken(user);
  return { user, token };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  const token = signToken(safeUser);
  return { user: safeUser, token };
}
