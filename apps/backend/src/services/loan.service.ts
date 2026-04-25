import { addMonths, setDate, startOfDay, isAfter } from 'date-fns';
import { prisma } from '../config/prisma';
import { CreateLoanInput, UpdateLoanInput } from '../validators/loan.validator';

function calcInstallment(principal: number, monthlyRate: number, n: number): number {
  if (monthlyRate === 0) return principal / n;
  const r = monthlyRate / 100;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

function nextDueDate(startDate: Date, dueDayOfMonth: number): Date {
  const now = startOfDay(new Date());
  let candidate = setDate(startOfDay(startDate), dueDayOfMonth);
  if (!isAfter(candidate, now)) {
    candidate = setDate(addMonths(candidate, 1), dueDayOfMonth);
  }
  while (!isAfter(candidate, now)) {
    candidate = addMonths(candidate, 1);
  }
  return candidate;
}

async function findCategory(userId: number, names: string[]) {
  for (const name of names) {
    const cat = await prisma.category.findFirst({ where: { userId, name } });
    if (cat) return cat.id;
  }
  const fallback = await prisma.category.findFirst({ where: { userId } });
  return fallback?.id ?? null;
}

export const loanService = {
  async list(userId: number) {
    return prisma.loan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async get(userId: number, id: number) {
    return prisma.loan.findFirst({ where: { id, userId } });
  },

  async create(userId: number, data: CreateLoanInput) {
    const type = data.type ?? 'LOAN';

    if (type === 'BOLETO') {
      if (!data.dueDate) throw new Error('dueDate obrigatório para boleto');
      const due = new Date(data.dueDate);
      return prisma.loan.create({
        data: {
          userId,
          type: 'BOLETO',
          name: data.name,
          principalAmount: data.principalAmount,
          currentBalance: data.principalAmount,
          interestRate: 0,
          startDate: new Date(),
          dueDayOfMonth: due.getDate(),
          dueDate: due,
          notes: data.notes ?? null,
        },
      });
    }

    if (type === 'CREDIT_CARD') {
      const interestRate = data.interestRate ?? 0;
      const installmentAmount =
        data.installments && data.installments > 0
          ? calcInstallment(data.principalAmount, interestRate, data.installments)
          : null;
      return prisma.loan.create({
        data: {
          userId,
          type: 'CREDIT_CARD',
          name: data.name,
          principalAmount: data.principalAmount,
          currentBalance: data.principalAmount,
          interestRate,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          dueDayOfMonth: data.dueDayOfMonth ?? 10,
          closingDay: data.closingDay ?? null,
          installments: data.installments ?? null,
          installmentAmount,
          notes: data.notes ?? null,
        },
      });
    }

    // LOAN (default)
    if (!data.startDate) throw new Error('startDate obrigatório para empréstimo');
    if (!data.dueDayOfMonth) throw new Error('dueDayOfMonth obrigatório para empréstimo');
    const interestRate = data.interestRate ?? 0;
    const installmentAmount =
      data.installments && data.installments > 0
        ? calcInstallment(data.principalAmount, interestRate, data.installments)
        : null;

    return prisma.loan.create({
      data: {
        userId,
        type: 'LOAN',
        name: data.name,
        principalAmount: data.principalAmount,
        currentBalance: data.principalAmount,
        interestRate,
        startDate: new Date(data.startDate),
        dueDayOfMonth: data.dueDayOfMonth,
        installments: data.installments ?? null,
        installmentAmount,
        notes: data.notes ?? null,
      },
    });
  },

  async update(userId: number, id: number, data: UpdateLoanInput) {
    const existing = await prisma.loan.findFirst({ where: { id, userId } });
    if (!existing) return null;

    let installmentAmount = existing.installmentAmount ? Number(existing.installmentAmount) : null;
    const rate = data.interestRate ?? Number(existing.interestRate);
    const n = data.installments !== undefined ? data.installments : (existing.installments ?? null);
    if (n && n > 0) {
      installmentAmount = calcInstallment(Number(existing.currentBalance), rate, n);
    }

    return prisma.loan.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.interestRate !== undefined && { interestRate: data.interestRate }),
        ...(data.dueDayOfMonth !== undefined && { dueDayOfMonth: data.dueDayOfMonth }),
        ...(data.closingDay !== undefined && { closingDay: data.closingDay }),
        ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
        ...(data.installments !== undefined && { installments: data.installments }),
        ...(installmentAmount !== null && { installmentAmount }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  async pay(userId: number, id: number, payType: 'FULL' | 'INTEREST_ONLY') {
    const loan = await prisma.loan.findFirst({ where: { id, userId, isActive: true } });
    if (!loan) return null;

    const balance = Number(loan.currentBalance);
    const now = new Date();

    // ── BOLETO: pagamento simples, sem amortização ──────────────────────────
    if (loan.type === 'BOLETO') {
      const categoryId = await findCategory(userId, ['Contas', 'Outros']);
      if (!categoryId) return null;

      const [payment] = await prisma.$transaction([
        prisma.loanPayment.create({
          data: {
            loanId: id,
            date: now,
            type: 'FULL',
            amount: balance,
            interestAmount: 0,
            principalAmount: balance,
            balanceBefore: balance,
            balanceAfter: 0,
          },
        }),
        prisma.loan.update({
          where: { id },
          data: { currentBalance: 0, totalPaid: Number(loan.totalPaid) + balance, isActive: false },
        }),
        prisma.transaction.create({
          data: {
            userId,
            categoryId,
            description: `Pagamento boleto — ${loan.name}`,
            amount: -balance,
            type: 'EXPENSE',
            date: now,
          },
        }),
      ]);
      return payment;
    }

    // ── LOAN / CREDIT_CARD: amortização Price ──────────────────────────────
    const monthlyRate = Number(loan.interestRate) / 100;
    const interestAmount = balance * monthlyRate;

    let paymentAmount: number;
    let principalPaid: number;
    let newBalance: number;

    if (payType === 'INTEREST_ONLY') {
      paymentAmount = interestAmount;
      principalPaid = 0;
      newBalance = balance;
    } else {
      const installment = loan.installmentAmount
        ? Number(loan.installmentAmount)
        : balance + interestAmount;
      paymentAmount = Math.min(installment, balance + interestAmount);
      principalPaid = paymentAmount - interestAmount;
      newBalance = Math.max(0, balance - principalPaid);
    }

    const isCompleted = newBalance <= 0.01;
    const categoryNames =
      loan.type === 'CREDIT_CARD' ? ['Cartão de Crédito', 'Outros'] : ['Empréstimos', 'Outros'];
    const categoryId = await findCategory(userId, categoryNames);
    if (!categoryId) return null;

    const description =
      payType === 'FULL'
        ? `Pagamento parcela — ${loan.name}`
        : `Pagamento juros — ${loan.name}`;

    const [payment] = await prisma.$transaction([
      prisma.loanPayment.create({
        data: {
          loanId: id,
          date: now,
          type: payType,
          amount: paymentAmount,
          interestAmount,
          principalAmount: principalPaid,
          balanceBefore: balance,
          balanceAfter: newBalance,
        },
      }),
      prisma.loan.update({
        where: { id },
        data: {
          currentBalance: newBalance,
          totalPaid: Number(loan.totalPaid) + paymentAmount,
          isActive: !isCompleted,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          categoryId,
          description,
          amount: -paymentAmount,
          type: 'EXPENSE',
          date: now,
        },
      }),
    ]);

    return payment;
  },

  async payments(userId: number, id: number) {
    const loan = await prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) return null;
    return prisma.loanPayment.findMany({
      where: { loanId: id },
      orderBy: { date: 'desc' },
    });
  },

  async schedule(userId: number, id: number) {
    const loan = await prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) return null;

    const balance = Number(loan.currentBalance);
    const rate = Number(loan.interestRate) / 100;
    const n = loan.installments ?? 120;
    const installment = loan.installmentAmount
      ? Number(loan.installmentAmount)
      : calcInstallment(balance, Number(loan.interestRate), n);

    const rows: {
      period: number;
      date: string;
      installment: number;
      interest: number;
      principal: number;
      balance: number;
    }[] = [];

    let currentBalance = balance;
    let dueDate = nextDueDate(loan.startDate, loan.dueDayOfMonth);

    for (let i = 1; i <= Math.min(n, 360) && currentBalance > 0.01; i++) {
      const interest = currentBalance * rate;
      const principal = Math.min(installment - interest, currentBalance);
      const newBalance = Math.max(0, currentBalance - principal);

      rows.push({
        period: i,
        date: dueDate.toISOString().split('T')[0],
        installment: Math.round((interest + principal) * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        balance: Math.round(newBalance * 100) / 100,
      });

      currentBalance = newBalance;
      dueDate = addMonths(dueDate, 1);
    }

    return rows;
  },

  async summary(userId: number) {
    const loans = await prisma.loan.findMany({ where: { userId, isActive: true } });
    const totalDebt = loans.reduce((s, l) => s + Number(l.currentBalance), 0);
    const totalPaid = loans.reduce((s, l) => s + Number(l.totalPaid), 0);

    const nextDue = loans
      .map((l) => {
        const due = l.dueDate
          ? l.dueDate.toISOString()
          : nextDueDate(l.startDate, l.dueDayOfMonth).toISOString();
        return {
          id: l.id,
          name: l.name,
          type: l.type,
          dueDate: due,
          installmentAmount: l.installmentAmount ? Number(l.installmentAmount) : null,
          currentBalance: Number(l.currentBalance),
          interestRate: Number(l.interestRate),
        };
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return { totalDebt, totalPaid, activeCount: loans.length, nextDue };
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.loan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await prisma.loan.delete({ where: { id } });
    return true;
  },
};
