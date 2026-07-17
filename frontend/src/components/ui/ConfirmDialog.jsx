/**
 * ConfirmDialog.jsx — Glassmorphism confirmation modal.
 * Replaces all browser confirm() calls.
 *
 * Usage:
 *   import { useConfirm } from '../ui/ConfirmDialog';
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete exam?',
 *     message: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     danger: true,
 *   });
 *   if (ok) { ... }
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuTriangleAlert } from 'react-icons/lu';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger }
  const resolveRef = useRef(null);

  const openConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState(options);
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setState(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={openConfirm}>
      {children}

      <AnimatePresence>
        {state && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={handleCancel}
          >
            <motion.div
              key="confirm-card"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-md rounded-3xl p-7 relative"
              style={{
                background: 'rgba(18,18,18,0.97)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: state.danger ? 'rgba(239,68,68,0.1)' : 'rgba(204,255,0,0.08)',
                  border: `1px solid ${state.danger ? 'rgba(239,68,68,0.25)' : 'rgba(204,255,0,0.2)'}`,
                }}
              >
                <LuTriangleAlert
                  size={22}
                  style={{ color: state.danger ? '#ef4444' : '#ccff00' }}
                />
              </div>

              {/* Title */}
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: '#ebebeb', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                {state.title || 'Are you sure?'}
              </h3>

              {/* Message */}
              <p
                className="text-sm mb-7"
                style={{ color: 'rgba(235,235,235,0.55)', lineHeight: 1.6 }}
              >
                {state.message || 'This action cannot be undone.'}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(235,235,235,0.6)',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#ebebeb'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.color = 'rgba(235,235,235,0.6)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
                  style={{
                    background: state.danger ? '#ef4444' : '#ccff00',
                    color: state.danger ? '#fff' : '#0c0c0c',
                    fontFamily: "'Space Grotesk', sans-serif",
                    boxShadow: state.danger
                      ? '0 0 20px rgba(239,68,68,0.25)'
                      : '0 0 20px rgba(204,255,0,0.2)',
                  }}
                >
                  {state.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}
