import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, id, className = '', style, disabled, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-foreground)',
            }}
          >
            {label}
          </label>
        )}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {leftIcon && (
            <span
              style={{
                position: 'absolute',
                left: '12px',
                display: 'inline-flex',
                color: 'var(--color-muted-foreground)',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            style={{
              width: '100%',
              height: '40px',
              paddingLeft: leftIcon ? '38px' : '12px',
              paddingRight: rightIcon ? '38px' : '12px',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-input)',
              color: 'var(--color-foreground)',
              border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              transition: 'var(--transition-fast)',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
              ...style,
            }}
            className={`matjer-input ${className}`}
            {...props}
          />
          {rightIcon && (
            <span
              style={{
                position: 'absolute',
                right: '12px',
                display: 'inline-flex',
                color: 'var(--color-muted-foreground)',
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>
        {error ? (
          <span style={{ fontSize: '12px', color: 'var(--color-destructive)' }} role="alert">
            {error}
          </span>
        ) : helperText ? (
          <span style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
