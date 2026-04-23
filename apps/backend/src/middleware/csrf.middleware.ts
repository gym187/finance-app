import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtect = (req: Request, _res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Only enforce when session cookies are present (login/register have none yet)
  const hasSession = !!(req.cookies?.access_token || req.cookies?.refresh_token);
  if (!hasSession) {
    next();
    return;
  }

  const cookieToken = req.cookies?.csrf_token as string | undefined;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(new AppError(403, 'CSRF token inválido'));
    return;
  }

  next();
};
