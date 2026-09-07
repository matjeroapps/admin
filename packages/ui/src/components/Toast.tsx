import React from 'react';

export interface ToastItem {
  id: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, type: 'info', durationMs: 4000, ...toast };
    setToasts((prev) => [...prev, newToast]);

    if (newToast.durationMs && newToast.durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.durationMs);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '360px',
          width: '100%',
        }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const typeBorder: Record<string, string> = {
    info: 'var(--color-info)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-destructive)',
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-card)',
        color: 'var(--color-card-foreground)',
        borderLeft: `4px solid ${typeBorder[toast.type || 'info']}`,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '13px',
      }}
    >
      <div>
        {toast.title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{toast.title}</div>}
        <div>{toast.message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-muted-foreground)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
};
