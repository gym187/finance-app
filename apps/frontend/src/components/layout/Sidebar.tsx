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
  LineChart,
  Repeat2,
  Wallet,
  CreditCard,
  Calculator,
  ChevronDown,
  Landmark,
  CalendarRange,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label?: string;
  icon?: LucideIcon;
  items: NavItem[];
  collapsible?: boolean;
};

const navGroups: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Finanças',
    icon: Landmark,
    collapsible: true,
    items: [
      { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
      { href: '/investments', label: 'Investimentos', icon: LineChart },
      { href: '/loans', label: 'Dívidas', icon: CreditCard },
      { href: '/categories', label: 'Categorias', icon: FolderOpen },
    ],
  },
  {
    label: 'Planejamento',
    icon: CalendarRange,
    collapsible: true,
    items: [
      { href: '/goals', label: 'Metas', icon: Target },
      { href: '/budgets', label: 'Orçamentos', icon: Wallet },
      { href: '/recurring', label: 'Recorrentes', icon: Repeat2 },
    ],
  },
  {
    items: [
      { href: '/reports', label: 'Relatórios', icon: BarChart3 },
      { href: '/calculadora', label: 'Calculadora', icon: Calculator },
    ],
  },
];

const MobileSidebarContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

const DesktopSidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export const useMobileSidebar = () => useContext(MobileSidebarContext);
export const useDesktopSidebar = () => useContext(DesktopSidebarContext);

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      <DesktopSidebarContext.Provider value={{ collapsed, setCollapsed }}>
        {children}
      </DesktopSidebarContext.Provider>
    </MobileSidebarContext.Provider>
  );
}

function NavGroupSection({
  group,
  collapsed,
  pathname,
  onNavClick,
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  onNavClick?: () => void;
}) {
  const isGroupActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  const [open, setOpen] = useState(isGroupActive || !group.collapsible);
  const GroupIcon = group.icon;

  if (!group.label) {
    return (
      <div className="space-y-0.5">
        {group.items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Group header */}
      {collapsed ? (
        <div className="flex justify-center px-3 py-2">
          {GroupIcon && <GroupIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          {GroupIcon && <GroupIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              open ? 'rotate-180' : ''
            )}
          />
        </button>
      )}

      {/* Group items */}
      {(open || collapsed) && (
        <div className={cn('mt-0.5 space-y-0.5', !collapsed && 'pl-3')}>
          {group.items.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavClick}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center' : 'gap-3',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  onNavClick,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Logo */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          'flex w-full items-center border-b transition-colors',
          collapsed ? 'justify-center px-0 py-5' : 'gap-2.5 px-6 py-5',
          onToggleCollapse ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default'
        )}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <TrendingUp className="h-4 w-4" />
        </div>
        {!collapsed && <span className="text-lg font-bold">FinanceApp</span>}
      </button>

      {/* User */}
      {!collapsed && (
        <div className="border-b px-6 py-4">
          <p className="text-xs text-muted-foreground">Bem-vindo,</p>
          <p className="truncate text-sm font-medium">{user?.name ?? user?.email ?? 'Usuário'}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navGroups.map((group, i) => (
          <NavGroupSection
            key={i}
            group={group}
            collapsed={collapsed}
            pathname={pathname}
            onNavClick={onNavClick}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t p-3">
        <button
          onClick={() => { onNavClick?.(); logout(); }}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { open, setOpen } = useMobileSidebar();
  const { collapsed, setCollapsed } = useDesktopSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden h-full flex-shrink-0 flex-col border-r bg-card lg:flex transition-[width] duration-300 overflow-hidden',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarContent onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
