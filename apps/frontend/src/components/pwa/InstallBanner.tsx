'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/providers/PWAProvider';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'pwa-install-dismissed';

export function InstallBanner() {
  const { canInstall, install } = usePWA();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 border-t bg-background px-4 py-3 shadow-lg sm:hidden">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="h-6 w-6">
          <rect width="512" height="512" rx="96" fill="white" fillOpacity={0.2} />
          <polyline
            points="88,372 196,228 296,292 424,144"
            stroke="white"
            strokeWidth="60"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <polyline
            points="332,144 424,144 424,236"
            stroke="white"
            strokeWidth="60"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instalar AppFin</p>
        <p className="truncate text-xs text-muted-foreground">Acesse suas finanças de qualquer lugar</p>
      </div>

      <button
        onClick={install}
        className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
      >
        Instalar
      </button>

      <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
