import React from 'react';
import { Card } from '../components/Card.js';
import { Button } from '../components/Button.js';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this page. Please try again or contact support.',
  onRetry,
}) => {
  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        borderColor: 'var(--color-destructive)',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '36px', color: 'var(--color-destructive)' }}>⚠️</div>
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted-foreground)', maxWidth: '420px' }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} style={{ marginTop: '8px' }}>
          Retry Request
        </Button>
      )}
    </Card>
  );
};
