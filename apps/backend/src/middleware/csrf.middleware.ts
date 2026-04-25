import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Auth endpoints that create/destroy sessions — never need CSRF protection
const CSRF_EXEMPT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
]);

export const csrfProtect = (req: Request, _res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (CSRF_EXEMPT.has(req.path)) {
    next();
    return;
  }

  // Only enforce when session cookies are present
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
