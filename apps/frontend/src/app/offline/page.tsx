'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3l18 18M8.111 8.111A3.982 3.982 0 007 12a4 4 0 004 4 3.982 3.982 0 002.889-1.111M10.584 5.659A7 7 0 0119 12a6.978 6.978 0 01-1.177 3.89M6.228 6.228A10.451 10.451 0 003 12c0 2.5.876 4.796 2.328 6.586M21 3L3 21"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sem conexão</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Você está offline. Verifique sua conexão com a internet e tente novamente.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Tentar novamente
      </button>
    </div>
  );
}
