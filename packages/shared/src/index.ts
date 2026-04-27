// ─── Enums ────────────────────────────────────────────────────────────────────
export type TransactionType = 'INCOME' | 'EXPENSE';
export type BudgetType = 'INCOME' | 'EXPENSE' | 'TOTAL';
export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'BTC';
export type InvestmentType = 'STOCK' | 'FII' | 'ETF' | 'CRYPTO' | 'FIXED_INCOME' | 'OTHER';
export type RecurrencyFreq = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type LoanType = 'LOAN' | 'CREDIT_CARD' | 'BOLETO';
export type LoanPaymentType = 'FULL' | 'INTEREST_ONLY';
export type NotificationType = 'BUDGET_ALERT' | 'GOAL_REACHED' | 'LOAN_DUE' | 'SYSTEM';
export type UserRole = 'USER' | 'ADMIN';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

// ─── Models ───────────────────────────────────────────────────────────────────
export interface UserSubscription {
  status: SubscriptionStatus;
  trialEnd: string | null;
  endDate: string | null;
  plan: { name: string; slug: string; price: number } | null;
}

export interface User {
  id: number;
  name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  document?: string | null;
  companyName?: string | null;
  telegramId?: string | null;
  emailVerified?: boolean;
  subscription?: UserSubscription | null;
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

export interface Tag {
  id: number;
  userId: number;
  name: string;
  color: string;
}

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
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: number;
  userId: number;
  categoryId: number | null;
  month?: string | null;
  amount: number;
  type: BudgetType;
  category?: Category | null;
}

export interface Investment {
  id: number;
  userId: number;
  name: string;
  ticker: string | null;
  type: InvestmentType;
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
  targetPercent: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: number;
  userId: number;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: number;
  category?: Category;
  frequency: RecurrencyFreq;
  startDate: string;
  endDate: string | null;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: number;
  userId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string | null;
  icon: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: number;
  userId: number;
  name: string;
  type: LoanType;
  principalAmount: number;
  currentBalance: number;
  interestRate: number;
  startDate: string;
  dueDayOfMonth: number;
  dueDate: string | null;
  closingDay: number | null;
  installments: number | null;
  installmentAmount: number | null;
  totalPaid: number;
  isActive: boolean;
  categoryId: number | null;
  category?: Category | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoanPayment {
  id: number;
  loanId: number;
  date: string;
  type: LoanPaymentType;
  amount: number;
  interestAmount: number;
  principalAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface AppNotification {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: NotificationType;
  link: string | null;
  read: boolean;
  createdAt: string;
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
  recurringItems?: RecurringTransaction[];
  goalsWidget?: DashboardGoalItem[];
  loansWidget?: DashboardLoanItem[];
  totalDebt?: number;
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
