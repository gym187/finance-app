import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AppFin — Controle Financeiro',
    short_name: 'AppFin',
    description: 'Gerencie suas finanças pessoais com facilidade e inteligência.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#22c55e',
    orientation: 'portrait-primary',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        description: 'Ver resumo financeiro',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Nova Transação',
        short_name: 'Transação',
        url: '/transactions',
        description: 'Registrar nova transação',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
    ],
  };
}
