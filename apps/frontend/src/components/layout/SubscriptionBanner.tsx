'use client';

import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Clock } from 'lucide-react';

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function SubscriptionBanner() {
  const { user } = useAuth();
  const sub = user?.subscription;
  if (!sub) return null;

  if (sub.status === 'SUSPENDED') {
    return (
      <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Sua conta está suspensa. Entre em contato com o suporte para regularizar.
      </div>
    );
  }

  if (sub.status === 'PAST_DUE') {
    return (
      <div className="bg-yellow-500 text-white px-4 py-2 text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Pagamento pendente. Regularize sua assinatura para evitar suspensão.
      </div>
    );
  }

  if (sub.status === 'TRIAL') {
    const days = daysUntil(sub.trialEnd);
    if (days !== null && days <= 7) {
      return (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          {days <= 0
            ? 'Seu período de trial expirou.'
            : `Seu trial expira em ${days} dia${days !== 1 ? 's' : ''}.`}
        </div>
      );
    }
  }

  return null;
}
