import React from 'react';
import { Sidebar, NavItem } from './Sidebar.js';
import { TopNavigation, TopNavigationProps } from './TopNavigation.js';

export interface DashboardLayoutProps {
  appTitle?: string;
  appLogo?: React.ReactNode;
  navItems: NavItem[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  breadcrumbsItems?: TopNavigationProps['breadcrumbsItems'];
  workspaces?: TopNavigationProps['workspaces'];
  activeWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  notifications?: TopNavigationProps['notifications'];
  user?: TopNavigationProps['user'];
  onSignOut?: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  appTitle = 'MatjerHub',
  appLogo,
  navItems,
  currentPath = '/',
  onNavigate,
  breadcrumbsItems,
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  notifications,
  user,
  onSignOut,
  children,
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [dir, setDir] = React.useState<'ltr' | 'rtl'>('ltr');
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  const toggleDir = () => {
    const nextDir = dir === 'ltr' ? 'rtl' : 'ltr';
    setDir(nextDir);
    document.documentElement.setAttribute('dir', nextDir);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div
      dir={dir}
      data-theme={theme}
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar
        appTitle={appTitle}
        appLogo={appLogo}
        navItems={navItems}
        currentPath={currentPath}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavigation
          breadcrumbsItems={breadcrumbsItems}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
          notifications={notifications}
          user={user}
          onSignOut={onSignOut}
          dir={dir}
          onToggleDir={toggleDir}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
};
