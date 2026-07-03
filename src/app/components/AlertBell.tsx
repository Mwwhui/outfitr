'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlerts, AlertItem } from '../hooks/useAlerts';

interface AlertBellProps {
  variant?: 'sidebar' | 'mobile';
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const EMPTY_TIPS = [
  { icon: 'auto_detect', text: 'Use YOLO auto-detect when uploading clothes — it fills in type, color, and season for you.' },
  { icon: 'style', text: 'Your Style Lab can analyze your outfit DNA and suggest new combinations.' },
  { icon: 'calendar_month', text: 'Connect Google Calendar to get occasion-based outfit suggestions.' },
  { icon: 'favorite', text: 'Pre-loved items can be donated, sold, or recycled — every item saved from landfill counts.' },
  { icon: 'dashboard', text: 'Check your Dashboard for cost-per-wear analytics and sustainability impact.' },
  { icon: 'checkroom', text: 'Items worn less than 3 times this month? Try mixing them back into rotation.' },
  { icon: 'qr_code', text: 'Partners can scan QR codes to fulfill pledges — no paperwork needed.' },
];

function EmptyState() {
  const tip = useMemo(() => EMPTY_TIPS[Math.floor(Math.random() * EMPTY_TIPS.length)], []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="px-5 py-8 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mx-auto mb-3">
        <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">
          notifications_off
        </span>
      </div>
      <p className="text-sm font-medium text-on-surface">No new alerts</p>
      <p className="text-xs text-on-surface-variant/60 mt-1 mb-4">
        You&apos;re all caught up!
      </p>
      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-surface-container/60 rounded-xl text-left">
        <span className="material-symbols-outlined text-base text-primary mt-0.5 shrink-0">
          {tip.icon}
        </span>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">{tip.text}</p>
      </div>
    </motion.div>
  );
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
  const { alerts, total, unreadCount, hasLoaded, markRead, isAlertRead, dismissAlert } = useAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const prevUnreadCount = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const PANEL_WIDTH = 320;

  const calcPanelLeft = useCallback((buttonRect: DOMRect) => {
    const center = buttonRect.left + buttonRect.width / 2;
    return Math.max(8, Math.min(center - PANEL_WIDTH / 2, window.innerWidth - PANEL_WIDTH - 8));
  }, []);

  const openPanel = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        left: calcPanelLeft(rect),
      });
    }
    setIsOpen((prev) => {
      if (!prev) {
        markRead();
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
      return !prev;
    });
  }, [calcPanelLeft, markRead]);

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

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

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

  // Shake bell when unread count increases (new alerts arrived via poll)
  useEffect(() => {
    if (hasLoaded && unreadCount > prevUnreadCount.current) {
      setShakeKey((k) => k + 1);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, hasLoaded]);

  const handleAction = (href: string, id: string) => {
    setIsOpen(false);
    dismissAlert(id);
    router.push(href);
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissAlert(id);
    setDismissingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 600);
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
        <motion.span
          key={shakeKey}
          animate={shakeKey > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="material-symbols-outlined text-xl inline-block"
        >
          notifications
        </motion.span>
        {unreadCount > 0 && (
          <motion.span
            key={hasLoaded ? `count-${unreadCount}` : 'init'}
            initial={hasLoaded ? { scale: 0.5 } : false}
            animate={hasLoaded ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
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
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/30">
              <h3 className="text-sm font-bold text-on-surface">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markRead}
                    className="text-xs text-primary font-medium px-2 py-1 hover:bg-surface-container rounded-lg transition"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-on-surface-variant hover:bg-surface-container rounded-lg transition"
                  aria-label="Close notifications"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

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
                <EmptyState />
              ) : (
                <div>
                  {alerts.map((alert, index) => {
                    const read = isAlertRead(alert.id);
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.2 }}
                        className={`group flex items-start gap-3 px-5 py-3.5 hover:bg-surface-container/40 transition cursor-pointer border-b border-outline-variant/20 last:border-b-0 ${
                          read ? 'opacity-50' : ''
                        }`}
                        onClick={() => handleAction(alert.actionHref, alert.id)}
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
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-primary font-medium flex items-center gap-0.5 group">
                              {alert.actionLabel}
                              <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-0.5">
                                arrow_forward
                              </span>
                            </p>
                            <span className="text-[10px] text-on-surface-variant/50">
                              {formatTimeAgo(alert.discoveredAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDismiss(alert.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition p-0.5 text-on-surface-variant/40 hover:text-on-surface rounded"
                          aria-label="Mark as read"
                        >
                          <motion.span
                            className={`material-symbols-outlined text-sm ${
                              dismissingIds.has(alert.id) ? 'text-green-600' : ''
                            }`}
                            animate={dismissingIds.has(alert.id)
                              ? { scale: [1, 1.35, 1] }
                              : { scale: 1 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          >
                            mark_email_read
                          </motion.span>
                        </button>
                        {!read && (
                          <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
