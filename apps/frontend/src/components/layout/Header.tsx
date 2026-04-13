'use client';

import { usePathname } from 'next/navigation';
import { Moon, Sun, Menu, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/hooks/useDashboard';
import { useMobileSidebar } from '@/components/layout/Sidebar';

const pathLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transações',
  '/categories': 'Categorias',
  '/budgets': 'Orçamentos',
  '/reports': 'Relatórios',
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: dashboard } = useDashboard();
  const { setOpen } = useMobileSidebar();

  const label = pathLabels[pathname] ?? 'Página';
  const alertCount = dashboard?.alerts?.length ?? 0;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:h-16 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold sm:text-lg">{label}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Alerts indicator */}
        {alertCount > 0 && (
          <div className="relative">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {alertCount}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}
