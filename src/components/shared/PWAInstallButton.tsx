// ============================================================================
// PWA Install Button & Instructions Modal
// ============================================================================

import React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared";
import { usePWA } from "@/lib/use-pwa";
import { motion, AnimatePresence } from "framer-motion";

export function PWAInstallButton({ variant = "outline", size = "sm", className = "" }: { variant?: any; size?: any; className?: string }) {
  const { canInstall, isInstalled, triggerInstall, showIOSModal, setShowIOSModal, isIOS } = usePWA();

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={triggerInstall}
        className={`gap-1.5 text-xs font-medium border-primary/20 hover:border-primary/40 text-primary dark:text-sky-300 bg-primary/5 hover:bg-primary/10 transition-all ${className}`}
        title="Install INFOHAS ATS as an app on your device"
      >
        <Icon name="Download" className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">App</span>
      </Button>

      {/* iOS / General Install Help Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card text-card-foreground border border-border max-w-sm w-full p-6 rounded-2xl shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Icon name="Smartphone" className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base">Install INFOHAS ATS</h3>
                    <p className="text-xs text-muted-foreground">Add to your device home screen</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <Icon name="X" className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    To install on iPhone or iPad:
                  </p>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/60">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <span className="text-xs leading-tight">Tap the <strong>Share button</strong> (<span className="text-primary font-semibold">⎋</span>) in Safari's bottom toolbar</span>
                  </div>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/60">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</div>
                    <span className="text-xs leading-tight">Scroll down and tap <strong>'Add to Home Screen'</strong> (<span className="text-primary font-semibold">⊞</span>)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    To install in Google Chrome, Edge, or Android:
                  </p>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/60">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <span className="text-xs leading-tight">Click the <strong>Install icon</strong> in your browser's address bar or menu (⋮)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/60">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</div>
                    <span className="text-xs leading-tight">Select <strong>'Install INFOHAS ATS'</strong> for full offline access</span>
                  </div>
                </div>
              )}

              <Button
                variant="default"
                className="w-full text-xs font-semibold"
                onClick={() => setShowIOSModal(false)}
              >
                Got It
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
