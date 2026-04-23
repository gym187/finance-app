// ─── Enums ────────────────────────────────────────────────────────────────────
export type TransactionType = 'INCOME' | 'EXPENSE';
export type BudgetType = 'INCOME' | 'EXPENSE' | 'TOTAL';

// ─── Models ───────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string | null;
  email: string;
  telegramId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  userId: number;
}

export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'BTC';

export interface Transaction {
  id: number;
  userId: number;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: number;
  category?: Category;
  date: string;
  currency: Currency;
  amountOriginal: number | null;
  exchangeRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: number;
  userId: number;
  categoryId: number | null;
  month: string;
  amount: number;
  type: BudgetType;
  category?: Category | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardGoalItem {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  icon: string | null;
  percent: number;
}

export interface DashboardData {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  monthlyBalance: number;
  previousMonthBalance: number;
  balanceVariation: number;
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  budgetSummary: BudgetSummary[];
  alerts: Alert[];
  recurringIncome?: number;
  recurringExpense?: number;
  recurringItems?: unknown[];
  goalsWidget?: DashboardGoalItem[];
  loansWidget?: DashboardLoanItem[];
  totalDebt?: number;
}

export interface DashboardLoanItem {
  id: number;
  name: string;
  currentBalance: number;
  installmentAmount: number;
  nextDueDate: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export interface BudgetSummary {
  id: number;
  categoryId: number | null;
  categoryName: string;
  budgeted: number;
  spent: number;
  percentage: number;
  type: BudgetType;
}

export interface Alert {
  type: 'warning' | 'danger';
  message: string;
  categoryId?: number;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

// ─── Query Params ─────────────────────────────────────────────────────────────
export interface TransactionQuery {
  page?: number;
  limit?: number;
  type?: TransactionType;
  categoryId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}
