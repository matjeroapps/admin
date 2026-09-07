import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  style,
  className = '',
  ...props
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' },
    secondary: { backgroundColor: 'var(--color-secondary)', color: 'var(--color-on-secondary)' },
    success: { backgroundColor: 'var(--color-success)', color: 'var(--color-on-success)' },
    warning: { backgroundColor: 'var(--color-warning)', color: 'var(--color-on-warning)' },
    destructive: { backgroundColor: 'var(--color-destructive)', color: 'var(--color-on-destructive)' },
    outline: { backgroundColor: 'transparent', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '2px 6px', fontSize: '11px' },
    md: { padding: '4px 10px', fontSize: '12px' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      className={`matjer-badge ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
