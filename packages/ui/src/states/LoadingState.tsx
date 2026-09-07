import React from 'react';
import { Skeleton } from '../components/Skeleton.js';
import { Card } from '../components/Card.js';

export interface LoadingStateProps {
  type?: 'card' | 'table' | 'fullPage';
  title?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'card',
  title = 'Loading data...',
}) => {
  if (type === 'fullPage') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          gap: '16px',
        }}
      >
        <Skeleton variant="circular" width="48px" height="48px" />
        <span style={{ fontSize: '14px', color: 'var(--color-muted-foreground)' }}>{title}</span>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Skeleton variant="text" width="30%" height="24px" />
        <Skeleton variant="table" height="180px" />
      </Card>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {title && <span style={{ fontSize: '14px', color: 'var(--color-muted-foreground)' }}>{title}</span>}
      <Skeleton variant="text" width="50%" height="20px" />
      <Skeleton variant="text" width="80%" height="16px" />
      <Skeleton variant="rectangular" height="100px" />
    </Card>
  );
};
