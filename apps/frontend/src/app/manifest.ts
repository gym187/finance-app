import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AppFin — Controle Financeiro',
    short_name: 'AppFin',
    description: 'Gerencie suas finanças pessoais com facilidade e inteligência.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#1d1d21',
    theme_color: '#22c55e',
    orientation: 'portrait-primary',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        description: 'Ver resumo financeiro',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Nova Transação',
        short_name: 'Transação',
        url: '/transactions',
        description: 'Registrar nova transação',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
