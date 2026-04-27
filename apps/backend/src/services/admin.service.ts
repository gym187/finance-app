import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  document: true,
  companyName: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  subscription: {
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      trialEnd: true,
      notes: true,
      plan: { select: { id: true, name: true, slug: true, price: true } },
    },
  },
} as const;

export const adminService = {
  async listUsers(params: { search?: string; status?: string; page?: number; limit?: number }) {
    const { search, status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { companyName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(status ? { subscription: { status: status as never } } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  },

  async getUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new AppError(404, 'Usuário não encontrado');
    return user;
  },

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    document?: string;
    companyName?: string;
    planSlug?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email já cadastrado');

    const plan = await prisma.plan.findUnique({
      where: { slug: data.planSlug ?? 'pro' },
    });
    if (!plan) throw new AppError(404, 'Plano não encontrado');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone ?? null,
        document: data.document ?? null,
        companyName: data.companyName ?? null,
        emailVerified: true,
        subscription: {
          create: {
            planId: plan.id,
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: addDays(new Date(), 30),
          },
        },
      },
      select: USER_SELECT,
    });

    await createDefaultCategories(user.id);
    return user;
  },

  async updateUser(
    adminId: number,
    id: number,
    data: {
      name?: string;
      phone?: string;
      document?: string;
      companyName?: string;
      role?: 'USER' | 'ADMIN';
    }
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Usuário não encontrado');

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.document !== undefined && { document: data.document }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.role !== undefined && { role: data.role }),
      },
      select: USER_SELECT,
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'UPDATE_USER',
        targetId: id,
        targetType: 'User',
        details: data,
      },
    });

    return user;
  },

  async updateSubscription(
    adminId: number,
    userId: number,
    data: {
      status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
      endDate?: string | null;
      planSlug?: string;
      notes?: string;
    }
  ) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new AppError(404, 'Assinatura não encontrada');

    let planId = sub.planId;
    if (data.planSlug) {
      const plan = await prisma.plan.findUnique({ where: { slug: data.planSlug } });
      if (!plan) throw new AppError(404, 'Plano não encontrado');
      planId = plan.id;
    }

    const updated = await prisma.subscription.update({
      where: { userId },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.notes !== undefined && { notes: data.notes }),
        planId,
      },
      include: { plan: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'UPDATE_SUBSCRIPTION',
        targetId: userId,
        targetType: 'Subscription',
        details: data,
      },
    });

    return updated;
  },

  async getMetrics() {
    const [totalUsers, byStatus, plans, recentUsers, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.plan.findMany({
        include: { _count: { select: { subscriptions: true } } },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, subscription: { select: { status: true, plan: { select: { name: true } } } } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { admin: { select: { name: true, email: true } } },
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.status]));

    const activeCount = statusMap['ACTIVE'] ?? 0;
    const trialCount = statusMap['TRIAL'] ?? 0;
    const pastDueCount = statusMap['PAST_DUE'] ?? 0;
    const suspendedCount = statusMap['SUSPENDED'] ?? 0;
    const cancelledCount = statusMap['CANCELLED'] ?? 0;

    const mrr = await prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
      include: { plan: { select: { price: true } } },
    });
    const mrrTotal = mrr.reduce((s, sub) => s + Number(sub.plan.price), 0);

    return {
      totalUsers,
      activeCount,
      trialCount,
      pastDueCount,
      suspendedCount,
      cancelledCount,
      mrr: mrrTotal,
      plans: plans.map((p) => ({ ...p, price: Number(p.price), count: p._count.subscriptions })),
      recentUsers,
      auditLogs,
    };
  },

  async listPlans() {
    return prisma.plan.findMany({ orderBy: { price: 'asc' } });
  },

  async upsertPlan(data: { name: string; slug: string; description?: string; price: number; trialDays?: number }) {
    return prisma.plan.upsert({
      where: { slug: data.slug },
      update: { name: data.name, description: data.description, price: data.price, trialDays: data.trialDays ?? 14 },
      create: { name: data.name, slug: data.slug, description: data.description, price: data.price, trialDays: data.trialDays ?? 14 },
    });
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
