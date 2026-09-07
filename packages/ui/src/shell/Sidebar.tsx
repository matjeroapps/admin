import React from 'react';
import { Badge } from '../components/Badge.js';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  badge?: string;
  children?: NavItem[];
}

export interface SidebarProps {
  appTitle?: string;
  appLogo?: React.ReactNode;
  navItems: NavItem[];
  currentPath?: string;
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appTitle = 'MatjerHub',
  appLogo,
  navItems,
  currentPath = '/',
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}) => {
  return (
    <aside
      style={{
        width: collapsed ? '64px' : '240px',
        height: '100vh',
        backgroundColor: 'var(--color-card)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        zIndex: 800,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: '60px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {appLogo || (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              M
            </div>
          )}
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-foreground)' }}>
              {appTitle}
            </span>
          )}
        </div>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted-foreground)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ◀
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate && onNavigate(item.path)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'var(--color-on-primary)' : 'var(--color-foreground)',
                    border: 'none',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {item.icon && <span>{item.icon}</span>}
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && item.badge && (
                    <Badge size="sm" variant={isActive ? 'secondary' : 'default'}>
                      {item.badge}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle Footer if Collapsed */}
      {onToggleCollapse && collapsed && (
        <div style={{ padding: '12px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted-foreground)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ▶
          </button>
        </div>
      )}
    </aside>
  );
};
