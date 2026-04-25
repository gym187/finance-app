import type { ApiResponse, PaginatedResponse } from '@finance-app/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const isMutating = options.method && options.method !== 'GET';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
      ...(isMutating ? { 'X-CSRF-Token': getCsrfToken() } : {}),
    };

    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Try to refresh token on 401
    if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/profile') {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(path, options);
      }
      // Only redirect if not already on a public page (avoids infinite reload loop)
      if (typeof window !== 'undefined') {
        const pub = ['/login', '/register'];
        if (!pub.some((p) => window.location.pathname.startsWith(p))) {
          await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': getCsrfToken() },
          }).catch(() => {});
          window.location.href = '/login';
        }
      }
      throw new Error('Sessão expirada');
    }

    if (res.status === 204) return undefined as T;

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }

    return data as T;
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  auth = {
    login: (email: string, password: string) =>
      this.request<ApiResponse<{ user: unknown }>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (email: string, password: string, name?: string) =>
      this.request<ApiResponse<{ user: unknown }>>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    profile: () => this.request<ApiResponse<unknown>>('/auth/profile'),

    logout: () =>
      this.request<ApiResponse<unknown>>('/auth/logout', { method: 'POST' }),

    verifyEmail: (token: string) =>
      this.request<ApiResponse<unknown>>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    resendVerification: (email: string) =>
      this.request<ApiResponse<unknown>>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    forgotPassword: (email: string) =>
      this.request<ApiResponse<unknown>>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      this.request<ApiResponse<unknown>>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  };

  // ─── Transactions ─────────────────────────────────────────────────────────
  transactions = {
    list: (params?: Record<string, string | undefined>) => {
      const filtered = params
        ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][])
        : undefined;
      const qs = filtered && Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : '';
      return this.request<PaginatedResponse<unknown> & { success: boolean }>(`/transactions${qs}`);
    },
    get: (id: number) => this.request<ApiResponse<unknown>>(`/transactions/${id}`),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/transactions/${id}`, { method: 'DELETE' }),
    exportCSV: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return fetch(`${API_URL}/api/transactions/export${qs}`, { credentials: 'include' });
    },
  };

  // ─── Categories ───────────────────────────────────────────────────────────
  categories = {
    list: () => this.request<ApiResponse<unknown[]>>('/categories'),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/categories/${id}`, { method: 'DELETE' }),
  };

  // ─── Budgets ──────────────────────────────────────────────────────────────
  budgets = {
    list: (month?: string) => {
      const qs = month ? `?month=${month}` : '';
      return this.request<ApiResponse<unknown[]>>(`/budgets${qs}`);
    },
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/budgets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/budgets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/budgets/${id}`, { method: 'DELETE' }),
  };

  // ─── Dashboard ────────────────────────────────────────────────────────────
  dashboard = {
    get: () => this.request<ApiResponse<unknown>>('/dashboard'),
    projection: () => this.request<ApiResponse<unknown>>('/dashboard/projection'),
  };

  // ─── Recurring Transactions ───────────────────────────────────────────────
  recurring = {
    list: () => this.request<ApiResponse<unknown[]>>('/recurring'),
    get: (id: number) => this.request<ApiResponse<unknown>>(`/recurring/${id}`),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/recurring', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/recurring/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/recurring/${id}`, { method: 'DELETE' }),
  };

  // ─── CSV Import ───────────────────────────────────────────────────────────
  csvImport = {
    parse: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetch(`${API_URL}/api/import/parse`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: form,
      }).then((r) => r.json());
    },
    confirm: (rows: unknown[]) =>
      this.request<ApiResponse<unknown>>('/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
  };

  // ─── Loans ────────────────────────────────────────────────────────────────
  loans = {
    list: () => this.request<ApiResponse<unknown[]>>('/loans'),
    summary: () => this.request<ApiResponse<unknown>>('/loans/summary'),
    get: (id: number) => this.request<ApiResponse<unknown>>(`/loans/${id}`),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/loans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/loans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    pay: (id: number, type: 'FULL' | 'INTEREST_ONLY') =>
      this.request<ApiResponse<unknown>>(`/loans/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    payments: (id: number) => this.request<ApiResponse<unknown[]>>(`/loans/${id}/payments`),
    schedule: (id: number) => this.request<ApiResponse<unknown[]>>(`/loans/${id}/schedule`),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/loans/${id}`, { method: 'DELETE' }),
  };

  // ─── Savings Goals ────────────────────────────────────────────────────────
  goals = {
    list: () => this.request<ApiResponse<unknown[]>>('/goals'),
    get: (id: number) => this.request<ApiResponse<unknown>>(`/goals/${id}`),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/goals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    contribute: (id: number, amount: number) =>
      this.request<ApiResponse<unknown>>(`/goals/${id}/contribute`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/goals/${id}`, { method: 'DELETE' }),
  };

  // ─── Exchange ─────────────────────────────────────────────────────────────
  exchange = {
    rates: () => this.request<ApiResponse<{ rates: Record<string, number>; currencies: string[] }>>('/exchange/rates'),
  };

  // ─── Tags ─────────────────────────────────────────────────────────────────
  tags = {
    list: () => this.request<ApiResponse<unknown[]>>('/tags'),
    create: (data: { name: string; color?: string }) =>
      this.request<ApiResponse<unknown>>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; color?: string }) =>
      this.request<ApiResponse<unknown>>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/tags/${id}`, { method: 'DELETE' }),
  };

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications = {
    list: () =>
      this.request<{ data: { notifications: unknown[]; unread: number } }>('/notifications'),
    markRead: (id: number) =>
      this.request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      this.request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),
    delete: (id: number) =>
      this.request<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
  };

  // ─── Investments ──────────────────────────────────────────────────────────
  investments = {
    list: () => this.request<ApiResponse<unknown[]>>('/investments'),
    summary: () => this.request<ApiResponse<unknown>>('/investments/summary'),
    get: (id: number) => this.request<ApiResponse<unknown>>(`/investments/${id}`),
    create: (data: unknown) =>
      this.request<ApiResponse<unknown>>('/investments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      this.request<ApiResponse<unknown>>(`/investments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      this.request<ApiResponse<unknown>>(`/investments/${id}`, { method: 'DELETE' }),
  };
}

export const api = new ApiClient();
