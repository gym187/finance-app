import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  userId?: number;
}

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  // Prefer httpOnly cookie; fall back to Bearer header for API/bot clients
  const cookieToken = req.cookies?.access_token as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const token = cookieToken ?? bearerToken ?? null;

  if (!token) {
    throw new AppError(401, 'Token de acesso não fornecido');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Token expirado');
    }
    throw new AppError(401, 'Token inválido');
  }
};
