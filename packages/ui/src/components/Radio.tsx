import React from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, id, disabled, style, className = '', ...props }, ref) => {
    const radioId = id || React.useId();

    return (
      <label
        htmlFor={radioId}
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
        className={`matjer-radio-label ${className}`}
      >
        <input
          id={radioId}
          type="radio"
          ref={ref}
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

Radio.displayName = 'Radio';

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  direction?: 'row' | 'column';
  label?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  children,
  direction = 'column',
  label,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} role="radiogroup" aria-label={label}>
      {label && (
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground)' }}>{label}</span>
      )}
      <div style={{ display: 'flex', flexDirection: direction, gap: '12px' }}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement<RadioProps>(child)) {
            return React.cloneElement(child, {
              name,
              checked: child.props.value === value,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                if (child.props.onChange) child.props.onChange(e);
                if (onChange) onChange(e.target.value);
              },
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};
