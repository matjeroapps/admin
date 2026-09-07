import React from 'react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, children, onDismiss }) => {
  const variantStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'var(--color-info)', text: 'var(--color-foreground)', icon: 'ℹ' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'var(--color-success)', text: 'var(--color-foreground)', icon: '✓' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'var(--color-warning)', text: 'var(--color-foreground)', icon: '⚠' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'var(--color-destructive)', text: 'var(--color-foreground)', icon: '✕' },
  };

  const styleConfig = variantStyles[variant];

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        backgroundColor: styleConfig.bg,
        borderLeft: `4px solid ${styleConfig.border}`,
        borderRadius: 'var(--radius-md)',
        color: styleConfig.text,
        fontSize: '14px',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{styleConfig.icon}</span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-muted-foreground)',
            fontSize: '14px',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
