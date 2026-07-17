/**
 * Toast.jsx — Global toast notification system.
 * Obsidian & Lime glassmorphism design.
 *
 * Usage:
 *   import { useToast } from '../ui/Toast';
 *   const toast = useToast();
 *   toast.success('File saved!');
 *   toast.error('Something went wrong.');
 *   toast.info('Import complete: 5 created, 2 skipped.');
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuCircleCheck, LuCircleX, LuInfo, LuX } from 'react-icons/lu';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: LuCircleCheck,
    border: 'rgba(204,255,0,0.3)',
    bg: 'rgba(204,255,0,0.06)',
    color: '#ccff00',
  },
  error: {
    icon: LuCircleX,
    border: 'rgba(239,68,68,0.35)',
    bg: 'rgba(239,68,68,0.06)',
    color: '#ef4444',
  },
  info: {
    icon: LuInfo,
    border: 'rgba(96,165,250,0.3)',
    bg: 'rgba(96,165,250,0.06)',
    color: '#60a5fa',
  },
};

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, duration = 4500) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = {
    success: (msg, dur) => addToast('success', msg, dur),
    error:   (msg, dur) => addToast('error', msg, dur),
    info:    (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        style={{ maxWidth: 380 }}
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const v = VARIANTS[t.type] || VARIANTS.info;
            const Icon = v.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                style={{
                  background: v.bg,
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${v.border}`,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <Icon size={18} style={{ color: v.color, marginTop: 1, flexShrink: 0 }} />
                <span
                  className="text-sm flex-1"
                  style={{ color: '#ebebeb', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.5 }}
                >
                  {t.message}
                </span>
                <button
                  onClick={() => dismiss(t.id)}
                  className="opacity-40 hover:opacity-100 transition-opacity"
                  style={{ color: '#ebebeb', flexShrink: 0 }}
                  aria-label="Dismiss"
                >
                  <LuX size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
