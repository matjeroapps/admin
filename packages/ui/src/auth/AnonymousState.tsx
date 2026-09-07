import React from 'react';
import { Card } from '../components/Card.js';
import { Button } from '../components/Button.js';

export interface AnonymousStateProps {
  onSignIn?: () => void;
  appName?: string;
}

export const AnonymousState: React.FC<AnonymousStateProps> = ({
  onSignIn,
  appName = 'MatjerHub',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
      }}
    >
      <Card
        variant="glass"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '36px 28px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
          }}
        >
          M
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Sign in to {appName}</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--color-muted-foreground)' }}>
            Authentication is required to access workspace portals and administrative capabilities.
          </p>
        </div>
        <Button size="lg" onClick={onSignIn} style={{ width: '100%', marginTop: '8px' }}>
          Continue with Zitadel SSO
        </Button>
        <span style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>
          Secured by MatjerHub Zitadel Identity Integration
        </span>
      </Card>
    </div>
  );
};
