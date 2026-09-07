import React from 'react';
import { WorkspaceSelector, Workspace } from './WorkspaceSelector.js';
import { NotificationsArea, Notification } from './NotificationsArea.js';
import { UserMenu, UserMenuProps } from './UserMenu.js';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs.js';
import { Button } from '../components/Button.js';

export interface TopNavigationProps {
  breadcrumbsItems?: BreadcrumbItem[];
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  notifications?: Notification[];
  user?: UserMenuProps['user'];
  onSignOut?: () => void;
  dir?: 'ltr' | 'rtl';
  onToggleDir?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  breadcrumbsItems = [{ label: 'Dashboard', href: '/' }],
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  notifications,
  user,
  onSignOut,
  dir = 'ltr',
  onToggleDir,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header
      style={{
        height: '60px',
        padding: '0 24px',
        backgroundColor: 'var(--color-card)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 750,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Breadcrumbs items={breadcrumbsItems} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <WorkspaceSelector
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
        />

        {onToggleDir && (
          <Button size="sm" variant="ghost" onClick={onToggleDir} aria-label="Toggle Direction">
            {dir.toUpperCase()}
          </Button>
        )}

        {onToggleTheme && (
          <Button size="sm" variant="ghost" onClick={onToggleTheme} aria-label="Toggle Theme">
            {theme === 'dark' ? '🌙' : '☀️'}
          </Button>
        )}

        <NotificationsArea notifications={notifications} />

        <UserMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
};
