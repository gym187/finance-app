import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from './error.middleware';
import { AuthenticatedRequest } from './auth.middleware';

export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.userId },
    select: { status: true },
  });
  if (sub?.status === 'SUSPENDED') {
    throw new AppError(403, 'Conta suspensa. Entre em contato com o suporte.');
  }
  next();
};
