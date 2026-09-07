import React from 'react';
import { Dropdown } from '../components/Dropdown.js';
import { Badge } from '../components/Badge.js';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read?: boolean;
}

export interface NotificationsAreaProps {
  notifications?: Notification[];
  onMarkAllAsRead?: () => void;
}

export const NotificationsArea: React.FC<NotificationsAreaProps> = ({
  notifications = [],
  onMarkAllAsRead,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Dropdown
      align="right"
      trigger={
        <div style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}>
          <span style={{ fontSize: '18px', color: 'var(--color-foreground)' }}>🔔</span>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              size="sm"
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                padding: '1px 5px',
                fontSize: '10px',
              }}
            >
              {unreadCount}
            </Badge>
          )}
        </div>
      }
    >
      <div style={{ width: '280px', padding: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            paddingBottom: '6px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Notifications</span>
          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              onClick={onMarkAllAsRead}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Mark all as read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: '12px', color: 'var(--color-muted-foreground)' }}>
            No recent notifications
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: n.read ? 'transparent' : 'var(--color-muted)',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div style={{ color: 'var(--color-muted-foreground)', margin: '2px 0' }}>{n.message}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)' }}>{n.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dropdown>
  );
};
