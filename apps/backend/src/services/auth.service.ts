import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { emailService } from './email.service';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

function generateTokens(userId: number) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

export const authService = {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(409, 'Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const verificationToken = generateSecureToken();

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
      select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true },
    });

    await createDefaultCategories(user.id);
    await emailService.sendEmailVerification(user.email, verificationToken);

    const tokens = generateTokens(user.id);
    return { user, ...tokens };
  },

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    const { password: _p, ...userWithoutPassword } = user;
    const tokens = generateTokens(user.id);
    return { user: userWithoutPassword, ...tokens };
  },

  async verifyEmail(token: string) {
    const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
    if (!user || !user.emailVerificationExpires) {
      throw new AppError(400, 'Token de verificação inválido');
    }
    if (user.emailVerificationExpires < new Date()) {
      throw new AppError(400, 'Token de verificação expirado');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
  },

  async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // silencia para não revelar se email existe

    if (user.emailVerified) {
      throw new AppError(400, 'Email já verificado');
    }

    const verificationToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    await emailService.sendEmailVerification(email, verificationToken);
  },

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // silencia para não revelar se email existe

    const resetToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await emailService.sendPasswordReset(email, resetToken);
  },

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpires) {
      throw new AppError(400, 'Token de redefinição inválido');
    }
    if (user.passwordResetExpires < new Date()) {
      throw new AppError(400, 'Token de redefinição expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  },

  async refreshTokens(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: number };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true },
      });
      if (!user) {
        throw new AppError(404, 'Usuário não encontrado');
      }
      const tokens = generateTokens(user.id);
      return { user, ...tokens };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, 'Refresh token inválido ou expirado');
    }
  },

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        telegramId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }
    return { ...user, telegramId: user.telegramId?.toString() ?? null };
  },

  async updateProfile(userId: number, data: { name?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true },
    });
    return user;
  },

  async linkTelegram(userId: number, telegramId: bigint) {
    const existing = await prisma.user.findUnique({ where: { telegramId } });
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'Esta conta do Telegram já está vinculada a outro usuário');
    }
    await prisma.user.update({ where: { id: userId }, data: { telegramId } });
  },

  async getUserByTelegramId(telegramId: bigint) {
    return prisma.user.findUnique({ where: { telegramId } });
  },
};

async function createDefaultCategories(userId: number) {
  const defaults = [
    { name: 'Salário', color: '#22c55e', icon: 'briefcase' },
    { name: 'Freelance', color: '#3b82f6', icon: 'laptop' },
    { name: 'Investimentos', color: '#8b5cf6', icon: 'trending-up' },
    { name: 'Alimentação', color: '#f97316', icon: 'utensils' },
    { name: 'Transporte', color: '#eab308', icon: 'car' },
    { name: 'Saúde', color: '#ef4444', icon: 'heart' },
    { name: 'Lazer', color: '#ec4899', icon: 'gamepad-2' },
    { name: 'Educação', color: '#06b6d4', icon: 'book' },
    { name: 'Moradia', color: '#84cc16', icon: 'home' },
    { name: 'Outros', color: '#6b7280', icon: 'more-horizontal' },
  ];

  await prisma.category.createMany({ data: defaults.map((c) => ({ ...c, userId })) });
}
