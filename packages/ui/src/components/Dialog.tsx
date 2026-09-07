import React from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthMap: Record<string, string> = {
    sm: '400px',
    md: '520px',
    lg: '680px',
    xl: '840px',
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'var(--glass-blur)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: widthMap[maxWidth],
          backgroundColor: 'var(--color-card)',
          color: 'var(--color-card-foreground)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-glass)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--color-muted-foreground)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          ✕
        </button>

        {title && (
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h2>
            {description && (
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-muted-foreground)' }}>
                {description}
              </p>
            )}
          </div>
        )}

        <div>{children}</div>

        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
