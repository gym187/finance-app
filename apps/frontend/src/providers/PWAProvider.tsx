'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAContextValue {
  canInstall: boolean;
  install: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue>({ canInstall: false, install: async () => {} });

export function usePWA() {
  return useContext(PWAContext);
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    const res = await fetch(`${API_URL}/api/push/vapid-key`, { credentials: 'include' });
    const { publicKey } = await res.json();
    if (!publicKey) return;

    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

    await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
    });
  } catch {}
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        if (Notification.permission === 'granted') {
          await subscribeToPush(reg);
        } else if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') await subscribeToPush(reg);
        }
      }).catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      deferredPrompt.current = null;
      setCanInstall(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt.current = null;
      setCanInstall(false);
    }
  }

  return <PWAContext.Provider value={{ canInstall, install }}>{children}</PWAContext.Provider>;
}
