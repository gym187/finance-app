'use client';

import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { ThemeProviderWrapper } from './ThemeProvider';
import { PWAProvider } from './PWAProvider';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProviderWrapper>
      <QueryProvider>
        <AuthProvider>
          <PWAProvider>
            {children}
            <Toaster richColors position="top-right" />
          </PWAProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProviderWrapper>
  );
}
