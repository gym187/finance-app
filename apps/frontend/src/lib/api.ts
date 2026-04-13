import type { ApiResponse, PaginatedResponse } from '@finance-app/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
    });

    // Try to refresh token on 401
    if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(path, options);
      }
      // Clear session and redirect to login
      this.clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
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
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  clearSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  saveSession(accessToken: string, refreshToken: string, user: unknown) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  auth = {
    login: (email: string, password: string) =>
      this.request<ApiResponse<{ accessToken: string; refreshToken: string; user: unknown }>>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      ),
    register: (email: string, password: string, name?: string) =>
      this.request<ApiResponse<{ accessToken: string; refreshToken: string; user: unknown }>>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify({ email, password, name }) }
      ),
    profile: () => this.request<ApiResponse<unknown>>('/auth/profile'),
    logout: () => this.request<ApiResponse<unknown>>('/auth/logout', { method: 'POST' }),
  };

  // ─── Transactions ─────────────────────────────────────────────────────────
  transactions = {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return this.request<PaginatedResponse<unknown> & { success: boolean }>(
        `/transactions${qs}`
      );
    },
    get: (id: number) =>
      this.request<ApiResponse<unknown>>(`/transactions/${id}`),
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
      const token = this.getToken();
      return fetch(`${API_URL}/api/transactions/export${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
  };
}

export const api = new ApiClient();
