'use client';

import { useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderOpen,
  Target,
  BarChart3,
  TrendingUp,
  LogOut,
  Send,
  LineChart,
  Repeat2,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/recurring', label: 'Recorrentes', icon: Repeat2 },
  { href: '/investments', label: 'Investimentos', icon: LineChart },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/loans', label: 'Empréstimos', icon: CreditCard },
  { href: '/categories', label: 'Categorias', icon: FolderOpen },
  { href: '/budgets', label: 'Orçamentos', icon: Wallet },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
];

// Context to allow Header to control mobile sidebar
const MobileSidebarContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const useMobileSidebar = () => useContext(MobileSidebarContext);

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <TrendingUp className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold">FinanceApp</span>
      </div>

      {/* User */}
      <div className="border-b px-6 py-4">
        <p className="text-xs text-muted-foreground">Bem-vindo,</p>
        <p className="truncate text-sm font-medium">{user?.name ?? user?.email ?? 'Usuário'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t p-3">
        <a
          href="https://t.me/appfin_guybot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground mb-1"
        >
          <Send className="h-4 w-4" />
          Bot do Telegram
        </a>
        <button
          onClick={() => { onNavClick?.(); logout(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { open, setOpen } = useMobileSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r bg-card lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SidebarContent onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
