import React from 'react';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, id, className = '', style, disabled, ...props }, ref) => {
    const selectId = id || React.useId();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        {label && (
          <label htmlFor={selectId} style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground)' }}>
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          style={{
            width: '100%',
            height: '40px',
            paddingLeft: '12px',
            paddingRight: '32px',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            backgroundColor: 'var(--color-input)',
            color: 'var(--color-foreground)',
            border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            ...style,
          }}
          className={`matjer-select ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';
