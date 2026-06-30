'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlerts, AlertItem } from '../hooks/useAlerts';

interface AlertBellProps {
  variant?: 'sidebar' | 'mobile';
}

function getSeverityColor(severity: AlertItem['severity']) {
  switch (severity) {
    case 'warning':
      return 'text-amber-600';
    case 'error':
      return 'text-red-600';
    case 'success':
      return 'text-green-600';
    default:
      return 'text-blue-600';
  }
}

export default function AlertBell({ variant = 'sidebar' }: AlertBellProps) {
  const router = useRouter();
  const { alerts, total, hasLoaded } = useAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const PANEL_WIDTH = 320;

  const calcPanelLeft = useCallback((buttonRect: DOMRect) => {
    const center = buttonRect.left + buttonRect.width / 2;
    return Math.max(8, Math.min(center - PANEL_WIDTH / 2, window.innerWidth - PANEL_WIDTH - 8));
  }, []);

  // Calculate panel position when opening
  const openPanel = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        left: calcPanelLeft(rect),
      });
    }
    setIsOpen((prev) => !prev);
  }, [calcPanelLeft]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    // Use a timeout so the listener is added after the current click event finishes
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  // Recalculate position on resize
  const handleResize = useCallback(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        left: calcPanelLeft(rect),
      });
    }
  }, [isOpen, calcPanelLeft]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const handleAction = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const isMobile = variant === 'mobile';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={openPanel}
        className={`relative p-2 text-on-surface hover:bg-surface-container rounded-xl transition ${
          isMobile ? '' : 'hidden lg:block'
        }`}
        aria-label={`${total} notifications`}
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: panelPos.top,
              left: panelPos.left,
              width: PANEL_WIDTH,
              maxWidth: 'calc(100vw - 2rem)',
              zIndex: 50,
            }}
            className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-outline-variant/30 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/30">
              <h3 className="text-sm font-bold text-on-surface">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-on-surface-variant hover:bg-surface-container rounded-lg transition"
                aria-label="Close notifications"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
              {!hasLoaded ? (
                <div className="px-5 py-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-surface-variant animate-pulse shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-surface-variant rounded animate-pulse w-3/4" />
                        <div className="h-2 bg-surface-variant rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="px-5 py-10 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">
                      notifications_off
                    </span>
                  </div>
                  <p className="text-sm font-medium text-on-surface">No new alerts</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">
                    You&apos;re all caught up!
                  </p>
                </motion.div>
              ) : (
                <div>
                  {alerts.map((alert, index) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-container/40 transition cursor-pointer border-b border-outline-variant/20 last:border-b-0"
                      onClick={() => handleAction(alert.actionHref)}
                    >
                      <span
                        className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface leading-snug">{alert.message}</p>
                        <p className="text-xs text-primary mt-1 font-medium flex items-center gap-0.5 group">
                          {alert.actionLabel}
                          <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">
                            arrow_forward
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
