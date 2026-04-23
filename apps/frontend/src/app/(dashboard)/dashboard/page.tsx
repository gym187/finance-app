'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { BudgetProgress } from '@/components/dashboard/BudgetProgress';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { FinancialHealthBar } from '@/components/dashboard/FinancialHealthBar';
import { RecurringSummary } from '@/components/dashboard/RecurringSummary';
import { GoalsWidget } from '@/components/dashboard/GoalsWidget';
import { LoansWidget } from '@/components/dashboard/LoansWidget';
import { monthLabel, currentMonth } from '@/lib/formatters';
import type { DashboardGoalItem, DashboardLoanItem } from '@finance-app/shared';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-bold capitalize sm:text-2xl">{monthLabel(currentMonth())}</h2>
        <p className="text-sm text-muted-foreground">Resumo financeiro do mês atual</p>
      </div>

      {/* Summary KPI cards */}
      <QuickStats
        balance={data?.balance}
        totalIncome={data?.totalIncome}
        totalExpense={data?.totalExpense}
        savingsRate={data?.savingsRate}
        balanceVariation={data?.balanceVariation}
        isLoading={isLoading}
      />

      {/* Financial health score */}
      <FinancialHealthBar
        totalIncome={data?.totalIncome}
        totalExpense={data?.totalExpense}
        savingsRate={data?.savingsRate}
        budgetAlerts={data?.alerts?.length}
        isLoading={isLoading}
      />

      {/* Charts row: area chart + donut */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyChart data={data?.monthlyData} isLoading={isLoading} />
        </div>
        <CategoryPieChart data={data?.categoryData} isLoading={isLoading} />
      </div>

      {/* Recent transactions + budget */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <RecentTransactions />
        <BudgetProgress
          budgetSummary={data?.budgetSummary}
          alerts={data?.alerts}
          isLoading={isLoading}
        />
      </div>

      {/* Recurring summary + Goals row */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <RecurringSummary
          recurringIncome={(data as { recurringIncome?: number } | undefined)?.recurringIncome}
          recurringExpense={(data as { recurringExpense?: number } | undefined)?.recurringExpense}
          recurringItems={(data as { recurringItems?: unknown[] } | undefined)?.recurringItems as never}
          isLoading={isLoading}
        />
        <GoalsWidget
          goals={data?.goalsWidget as DashboardGoalItem[] | undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Loans widget */}
      <LoansWidget
        loans={data?.loansWidget as DashboardLoanItem[] | undefined}
        totalDebt={data?.totalDebt}
        isLoading={isLoading}
      />
    </div>
  );
}
