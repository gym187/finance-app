import crypto from 'crypto';
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../validators/auth.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

// 15 min in ms
const ACCESS_TOKEN_TTL = 15 * 60 * 1000;
// 7 days in ms
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

// secure:true exige HTTPS — desativado para deploys em HTTP (rede local)
const COOKIE_SECURE = env.COOKIE_SECURE === 'true';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const base = { secure: COOKIE_SECURE, sameSite: 'lax' as const, path: '/' };

  res.cookie('access_token', accessToken, { ...base, httpOnly: true, maxAge: ACCESS_TOKEN_TTL });
  res.cookie('refresh_token', refreshToken, { ...base, httpOnly: true, maxAge: REFRESH_TOKEN_TTL });
  // Non-httpOnly: readable by JS to set X-CSRF-Token header
  res.cookie('csrf_token', crypto.randomBytes(16).toString('hex'), {
    ...base,
    httpOnly: false,
    maxAge: REFRESH_TOKEN_TTL,
  });
}

function clearAuthCookies(res: Response) {
  const base = { path: '/' };
  res.clearCookie('access_token', base);
  res.clearCookie('refresh_token', base);
  res.clearCookie('csrf_token', base);
}

export const authController = {
  async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.register(data);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ success: true, data: { user } });
  },

  async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(data);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ success: true, data: { user } });
  },

  async refresh(req: Request, res: Response) {
    // Accept cookie first, then body for non-browser clients
    const refreshToken = (req.cookies?.refresh_token as string | undefined) ?? req.body?.refreshToken;
    if (!refreshToken) throw new AppError(401, 'Refresh token não fornecido');

    const { user, accessToken, refreshToken: newRefresh } = await authService.refreshTokens(refreshToken);
    setAuthCookies(res, accessToken, newRefresh);
    res.json({ success: true, data: { user } });
  },

  async profile(req: AuthenticatedRequest, res: Response) {
    const user = await authService.getProfile(req.userId!);
    res.json({ success: true, data: user });
  },

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    const { name } = req.body as { name?: string };
    const user = await authService.updateProfile(req.userId!, { name });
    res.json({ success: true, data: user });
  },

  async logout(_req: Request, res: Response) {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  },

  async verifyEmail(req: Request, res: Response) {
    const { token } = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    res.json({ success: true, message: 'Email verificado com sucesso' });
  },

  async resendVerification(req: Request, res: Response) {
    const { email } = resendVerificationSchema.parse(req.body);
    await authService.resendVerificationEmail(email);
    res.json({ success: true, message: 'Se o email existir, um novo link foi enviado' });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.json({ success: true, message: 'Se o email existir, as instruções foram enviadas' });
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ success: true, message: 'Senha redefinida com sucesso' });
  },
};
