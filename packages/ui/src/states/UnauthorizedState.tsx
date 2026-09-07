import React from 'react';
import { Card } from '../components/Card.js';
import { Button } from '../components/Button.js';

export interface UnauthorizedStateProps {
  title?: string;
  message?: string;
  onSignIn?: () => void;
}

export const UnauthorizedState: React.FC<UnauthorizedStateProps> = ({
  title = 'Access Denied',
  message = 'You do not have permission to view this resource. Please sign in with an authorized account.',
  onSignIn,
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
      <div style={{ fontSize: '40px' }}>🔒</div>
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted-foreground)', maxWidth: '420px' }}>
        {message}
      </p>
      {onSignIn && (
        <Button onClick={onSignIn} style={{ marginTop: '8px' }}>
          Sign In Now
        </Button>
      )}
    </Card>
  );
};
