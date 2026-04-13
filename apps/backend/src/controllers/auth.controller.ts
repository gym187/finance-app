import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema, refreshTokenSchema } from '../validators/auth.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const authController = {
  async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json({ success: true, data: result });
  },

  async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json({ success: true, data: result });
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshTokens(refreshToken);
    res.json({ success: true, data: result });
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
    // JWT is stateless; client discards tokens
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  },
};
