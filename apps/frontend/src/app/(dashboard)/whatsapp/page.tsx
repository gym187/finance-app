'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateLinkCode,
  useUnlinkWhatsapp,
  useWhatsappStatus,
  type LinkCode,
} from '@/hooks/useWhatsapp';

/** Mostra só código do país, DDD e últimos 4 dígitos. */
function maskPhone(phone: string | null): string {
  if (!phone) return 'número vinculado';
  const d = phone.replace(/\D/g, '');
  if (d.length < 8) return 'número vinculado';
  if (d.startsWith('55') && d.length >= 12) {
    return `+55 ${d.slice(2, 4)} •••••-${d.slice(-4)}`;
  }
  return `+${d.slice(0, d.length - 4 > 3 ? 2 : 1)} •••••-${d.slice(-4)}`;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function UsageCard() {
  const examples = [
    'gastei 47 no mercado',
    'recebi 3000 de salário',
    'quanto gastei esse mês?',
    'saldo',
    'últimas',
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como usar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="flex flex-wrap gap-2">
          {examples.map((e) => (
            <li key={e} className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs">
              {e}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Áudio funciona do mesmo jeito: basta falar o pedido. Todo lançamento é confirmado com{' '}
          <strong>&quot;sim&quot;</strong> antes de ser salvo.
        </p>
      </CardContent>
    </Card>
  );
}

function LinkedCard() {
  const { data } = useWhatsappStatus();
  const unlink = useUnlinkWhatsapp();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    unlink.mutate(undefined, { onSuccess: () => setOpen(false) });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-500/10 p-2 text-green-600 dark:text-green-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">WhatsApp vinculado</p>
            <p className="text-sm text-muted-foreground">{maskPhone(data?.phone ?? null)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Desvincular
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !unlink.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desvincular WhatsApp?</DialogTitle>
            <DialogDescription>
              O assistente deixará de responder neste número. Você pode vincular novamente quando quiser.
            </DialogDescription>
          </DialogHeader>
          {unlink.isError && (
            <p role="alert" className="text-sm text-destructive">
              {(unlink.error as Error).message || 'Não foi possível desvincular.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={unlink.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={unlink.isPending}>
              {unlink.isPending ? 'Desvinculando...' : 'Desvincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CodeDisplay({ link, onExpiredChange }: { link: LinkCode; onExpiredChange: (e: boolean) => void }) {
  const expiresMs = new Date(link.expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const remaining = expiresMs - now;
  const expired = remaining <= 0;

  useEffect(() => {
    onExpiredChange(expired);
  }, [expired, onExpiredChange]);

  useEffect(() => {
    setNow(Date.now());
    if (Date.now() >= expiresMs) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= expiresMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresMs]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível: o código segue visível para cópia manual */
    }
  };

  const botDigits = link.botNumber?.replace(/\D/g, '') ?? '';
  const waUrl = botDigits
    ? `https://wa.me/${botDigits}?text=${encodeURIComponent(link.code)}`
    : null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm">Envie este código para o número do bot no WhatsApp</p>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`font-mono text-3xl font-bold tracking-[0.3em] sm:text-4xl ${expired ? 'text-muted-foreground line-through' : ''}`}
          aria-label={`Código ${link.code.split('').join(' ')}`}
        >
          {link.code}
        </span>
        {!expired && (
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {expired ? 'Código expirado. Gere um novo.' : `Expira em ${formatCountdown(remaining)}`}
      </p>
      {!expired &&
        (waUrl ? (
          <Button asChild size="sm">
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir no WhatsApp
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">O número do bot ainda não foi configurado.</p>
        ))}
    </div>
  );
}

function UnlinkedCard() {
  const create = useCreateLinkCode();
  const [accepted, setAccepted] = useState(false);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [expired, setExpired] = useState(false);

  const generate = () => {
    setExpired(false);
    create.mutate(undefined, { onSuccess: (d) => setLink(d) });
  };

  // Polling do status apenas enquanto há um código válido na tela.
  useWhatsappStatus({ poll: !!link && !expired });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vincular WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          As mensagens e os dados financeiros consultados pelo WhatsApp são processados pela OpenAI para entender seus pedidos.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Entendi e aceito
        </label>
        <Button onClick={generate} disabled={!accepted || create.isPending}>
          {create.isPending ? 'Gerando...' : 'Gerar código'}
        </Button>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {(create.error as Error).message || 'Não foi possível gerar o código.'}
          </p>
        )}
        {link && <CodeDisplay link={link} onExpiredChange={setExpired} />}
      </CardContent>
    </Card>
  );
}

export default function WhatsappPage() {
  const { data, isLoading } = useWhatsappStatus();

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">WhatsApp</h2>
        <p className="text-sm text-muted-foreground">Lance e consulte suas finanças pelo WhatsApp</p>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : data?.linked ? <LinkedCard /> : <UnlinkedCard />}
      <UsageCard />
    </div>
  );
}
