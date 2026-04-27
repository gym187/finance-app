import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from './error.middleware';
import { AuthenticatedRequest } from './auth.middleware';

export const requireAdmin = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });
  if (!user || user.role !== 'ADMIN') {
    throw new AppError(403, 'Acesso restrito a administradores');
  }
  next();
};
