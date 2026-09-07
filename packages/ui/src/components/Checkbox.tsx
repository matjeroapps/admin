import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, indeterminate, id, disabled, style, className = '', ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const combinedRef = (node: HTMLInputElement) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    const checkboxId = id || React.useId();

    return (
      <label
        htmlFor={checkboxId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          userSelect: 'none',
          fontSize: '14px',
          color: 'var(--color-foreground)',
          ...style,
        }}
        className={`matjer-checkbox-label ${className}`}
      >
        <input
          id={checkboxId}
          type="checkbox"
          ref={combinedRef}
          disabled={disabled}
          style={{
            width: '18px',
            height: '18px',
            accentColor: 'var(--color-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          {...props}
        />
        {label && <span>{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
