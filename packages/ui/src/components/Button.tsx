import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontWeight: 500,
      fontFamily: 'var(--font-sans)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
      transition: 'var(--transition-fast)',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      outline: 'none',
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '4px 10px', fontSize: '13px', height: '32px' },
      md: { padding: '8px 16px', fontSize: '14px', height: '40px' },
      lg: { padding: '12px 24px', fontSize: '16px', height: '48px' },
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        borderColor: 'var(--color-primary)',
      },
      secondary: {
        backgroundColor: 'var(--color-secondary)',
        color: 'var(--color-on-secondary)',
        borderColor: 'var(--color-border)',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'var(--color-foreground)',
        borderColor: 'var(--color-border)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-foreground)',
        borderColor: 'transparent',
      },
      destructive: {
        backgroundColor: 'var(--color-destructive)',
        color: 'var(--color-on-destructive)',
        borderColor: 'var(--color-destructive)',
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={{
          ...baseStyle,
          ...sizeStyles[size],
          ...variantStyles[variant],
          ...style,
        }}
        className={`matjer-button ${className}`}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
