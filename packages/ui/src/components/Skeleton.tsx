import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'table';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  style,
  className = '',
  ...props
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    text: { height: height || '16px', width: width || '100%', borderRadius: 'var(--radius-sm)' },
    circular: { height: height || '40px', width: width || '40px', borderRadius: 'var(--radius-full)' },
    rectangular: { height: height || '120px', width: width || '100%', borderRadius: 'var(--radius-md)' },
    card: { height: height || '180px', width: width || '100%', borderRadius: 'var(--radius-lg)' },
    table: { height: height || '240px', width: width || '100%', borderRadius: 'var(--radius-md)' },
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-muted)',
        opacity: 0.7,
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        ...variantStyles[variant],
        ...style,
      }}
      className={`matjer-skeleton ${className}`}
      {...props}
    />
  );
};
