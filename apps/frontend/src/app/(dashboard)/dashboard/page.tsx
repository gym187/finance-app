'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { BalanceCards } from '@/components/dashboard/BalanceCards';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { BudgetProgress } from '@/components/dashboard/BudgetProgress';
import { monthLabel, currentMonth } from '@/lib/formatters';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">{monthLabel(currentMonth())}</h2>
        <p className="text-sm text-muted-foreground">Resumo financeiro do mês atual</p>
      </div>

      {/* Summary cards */}
      <BalanceCards
        balance={data?.balance}
        totalIncome={data?.totalIncome}
        totalExpense={data?.totalExpense}
        savingsRate={data?.savingsRate}
        balanceVariation={data?.balanceVariation}
        isLoading={isLoading}
      />

      {/* Charts row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyChart data={data?.monthlyData} isLoading={isLoading} />
        </div>
        <CategoryPieChart data={data?.categoryData} isLoading={isLoading} />
      </div>

      {/* Budget progress */}
      <BudgetProgress
        budgetSummary={data?.budgetSummary}
        alerts={data?.alerts}
        isLoading={isLoading}
      />
    </div>
  );
}
