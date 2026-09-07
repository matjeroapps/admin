import React from 'react';
import { Dropdown, DropdownItem, DropdownDivider } from '../components/Dropdown.js';
import { Badge } from '../components/Badge.js';

export interface UserMenuProps {
  user?: {
    name: string;
    email: string;
    role?: string;
    avatarUrl?: string;
  };
  onSignOut?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user = { name: 'Demo User', email: 'user@matjerhub.com', role: 'Administrator' },
  onSignOut,
  onProfileClick,
  onSettingsClick,
}) => {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dropdown
      align="right"
      trigger={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground)', lineHeight: 1.2 }}>
              {user.name}
            </span>
            {user.role && (
              <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }}>{user.role}</span>
            )}
          </div>
        </div>
      }
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{user.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>{user.email}</div>
        {user.role && (
          <div style={{ marginTop: '4px' }}>
            <Badge size="sm" variant="secondary">
              {user.role}
            </Badge>
          </div>
        )}
      </div>

      <DropdownItem label="User Profile" icon="👤" onClick={onProfileClick} />
      <DropdownItem label="Account Settings" icon="⚙" onClick={onSettingsClick} />
      <DropdownDivider />
      <DropdownItem label="Sign Out" icon="🚪" destructive onClick={onSignOut} />
    </Dropdown>
  );
};
