'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <img src="/icons/icon-72x72.png" alt="GenuineOS" className="w-12 h-12 rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install GenuineOS</p>
        <p className="text-xs text-muted-foreground">Open as app on your home screen</p>
      </div>
      <Button size="sm" onClick={handleInstall} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
        <Download className="w-4 h-4 mr-1" /> Install
      </Button>
      <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
