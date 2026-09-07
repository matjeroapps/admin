import React from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  position?: 'right' | 'left' | 'top' | 'bottom';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  position = 'right',
  children,
  footer,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    right: { top: 0, right: 0, bottom: 0, width: '380px', height: '100%' },
    left: { top: 0, left: 0, bottom: 0, width: '380px', height: '100%' },
    top: { top: 0, left: 0, right: 0, height: '320px', width: '100%' },
    bottom: { bottom: 0, left: 0, right: 0, height: '320px', width: '100%' },
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'var(--glass-blur)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          ...positionStyles[position],
          backgroundColor: 'var(--color-card)',
          color: 'var(--color-card-foreground)',
          borderLeft: position === 'right' ? '1px solid var(--color-border)' : 'none',
          borderRight: position === 'left' ? '1px solid var(--color-border)' : 'none',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted-foreground)',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>{footer}</div>}
      </div>
    </div>
  );
};
