import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, type = 'info', duration = 4000, title = null }) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev.slice(-4), { id, message, type, title }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  // Convenience wrappers
  toast.success = (message, opts) => toast({ message, type: 'success', ...opts });
  toast.error = (message, opts) => toast({ message, type: 'error', duration: 6000, ...opts });
  toast.warning = (message, opts) => toast({ message, type: 'warning', ...opts });
  toast.info = (message, opts) => toast({ message, type: 'info', ...opts });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function Toast({ id, message, type, title, onDismiss }) {
  return (
    <div className={`toast toast-${type} animate-slide-up`} role="alert">
      <span className={`toast-icon toast-icon-${type}`}>{ICONS[type] || 'ℹ'}</span>
      <div className="toast-body">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{message}</div>
      </div>
      <button className="toast-dismiss" onClick={() => onDismiss(id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
