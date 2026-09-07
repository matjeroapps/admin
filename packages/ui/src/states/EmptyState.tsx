import React from 'react';
import { Card } from '../components/Card.js';
import { Button } from '../components/Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📦',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '40px', lineHeight: 1 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted-foreground)', maxWidth: '400px' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} style={{ marginTop: '8px' }}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
};
