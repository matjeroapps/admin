export interface ColorPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  cardBorder: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  secondary: string;
  secondaryHover: string;
  onSecondary: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  onDestructive: string;
  success: string;
  warning: string;
  info: string;
}

export const tokens = {
  fonts: {
    sans: "'Fira Sans', system-ui, -apple-system, sans-serif",
    mono: "'Fira Code', monospace",
  },
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radii: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.25)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  },
};
