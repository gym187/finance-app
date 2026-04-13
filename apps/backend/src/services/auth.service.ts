import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

const SALT_ROUNDS = 12;

function generateTokens(userId: number) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(409, 'Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });

    // Create default categories for new user
    await createDefaultCategories(user.id);

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

  async refreshTokens(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: number };
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
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
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
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
