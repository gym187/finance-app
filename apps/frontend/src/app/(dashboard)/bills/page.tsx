'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoansView } from '@/components/bills/LoansView';
import { RecurringView } from '@/components/bills/RecurringView';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'fixas', label: 'Fixas' },
  { id: 'dividas', label: 'Dívidas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function BillsTabs() {
  const params = useSearchParams();
  const tab: TabId = params.get('tab') === 'dividas' ? 'dividas' : 'fixas';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Contas a pagar</h2>
        <p className="text-sm text-muted-foreground">
          Tudo que vence: contas fixas e dívidas com saldo.
        </p>
      </div>

      <div role="tablist" aria-label="Tipo de conta" className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            href={`/bills?tab=${t.id}`}
            replace
            className={cn(
              '-mb-px border-b-2 px-5 py-3 text-sm transition-colors',
              tab === t.id
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'dividas' ? <LoansView /> : <RecurringView />}
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsTabs />
    </Suspense>
  );
}
