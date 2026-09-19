'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { InvestmentsWidget } from '@/components/dashboard/InvestmentsWidget';
import { monthLabel, currentMonth } from '@/lib/formatters';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Visão geral</h2>
        <p className="text-sm capitalize text-muted-foreground">{monthLabel(currentMonth())}</p>
      </div>

      {/* Hero */}
      <DashboardHero
        balance={data?.balance}
        totalIncome={data?.totalIncome}
        totalExpense={data?.totalExpense}
        savingsRate={data?.savingsRate}
        isLoading={isLoading}
      />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryPieChart data={data?.categoryData} isLoading={isLoading} />
        <MonthlyChart data={data?.monthlyData} isLoading={isLoading} />
      </div>

      {/* Investimentos + Transações recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentTransactions />
        <InvestmentsWidget />
      </div>
    </div>
  );
}
