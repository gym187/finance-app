'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Trash2, Target, AlertCircle, CreditCard, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AppNotification,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications';

const TYPE_ICON: Record<AppNotification['type'], React.ReactNode> = {
  BUDGET_ALERT: <AlertCircle className="h-4 w-4 text-amber-500" />,
  GOAL_REACHED: <Target className="h-4 w-4 text-green-500" />,
  LOAN_DUE: <CreditCard className="h-4 w-4 text-red-500" />,
  SYSTEM: <Info className="h-4 w-4 text-blue-500" />,
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handleClick(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Check className="h-3 w-3" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'group flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition hover:bg-muted/50',
                    !n.read && 'bg-primary/5',
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="mt-0.5 shrink-0">{TYPE_ICON[n.type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs font-medium', !n.read && 'font-semibold')}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(n.id);
                    }}
                    className="mt-0.5 shrink-0 opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
