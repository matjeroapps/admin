import React from 'react';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';

export interface AuthenticatedStateProps {
  user: {
    name: string;
    email: string;
    role?: string;
    tenantId?: string;
  };
  onSignOut?: () => void;
}

export const AuthenticatedState: React.FC<AuthenticatedStateProps> = ({ user, onSignOut }) => {
  return (
    <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
            }}
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>{user.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-muted-foreground)' }}>{user.email}</div>
          </div>
        </div>
        <Badge variant="success">Authenticated</Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          padding: '12px',
          backgroundColor: 'var(--color-muted)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
        }}
      >
        <div>
          <span style={{ color: 'var(--color-muted-foreground)' }}>Role:</span>{' '}
          <strong>{user.role || 'User'}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--color-muted-foreground)' }}>Tenant ID:</span>{' '}
          <strong>{user.tenantId || 'default'}</strong>
        </div>
      </div>

      {onSignOut && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            Sign Out
          </Button>
        </div>
      )}
    </Card>
  );
};
