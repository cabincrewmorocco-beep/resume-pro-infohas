// ============================================================================
// PWA Installation & Offline State Hook
// ============================================================================

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    notify();
  });
}

export function usePWA() {
  const [canInstall, setCanInstall] = useState<boolean>(!!globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      setCanInstall(!!globalDeferredPrompt);
    };

    listeners.add(update);

    // Check if already standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    setIsInstalled(isStandalone);

    // Check iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    setIsIOS(isIosDevice && isSafari && !isStandalone);

    return () => {
      listeners.delete(update);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const choice = await globalDeferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          globalDeferredPrompt = null;
          setCanInstall(false);
          setIsInstalled(true);
          return true;
        }
      } catch (err) {
        console.warn("[PWA] Installation prompt error:", err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
      return false;
    } else {
      // Prompt user or open modal
      setShowIOSModal(true);
    }
    return false;
  }, [isIOS]);

  return {
    canInstall: canInstall || isIOS,
    isInstalled,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    triggerInstall,
  };
}
