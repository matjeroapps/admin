import React from 'react';
import { Select } from '../components/Select.js';

export interface Workspace {
  id: string;
  name: string;
  type?: 'seller' | 'supplier' | 'admin';
}

export interface WorkspaceSelectorProps {
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces = [
    { id: 'default-store', name: 'Default Store', type: 'seller' },
    { id: 'main-catalog', name: 'Main Catalog', type: 'supplier' },
    { id: 'platform-admin', name: 'Platform Admin', type: 'admin' },
  ],
  activeWorkspaceId = 'default-store',
  onWorkspaceChange,
}) => {
  const options = workspaces.map((ws) => ({
    label: `${ws.name} (${ws.type ? ws.type.toUpperCase() : 'WORKSPACE'})`,
    value: ws.id,
  }));

  return (
    <div style={{ width: '200px' }}>
      <Select
        options={options}
        value={activeWorkspaceId}
        onChange={(e) => onWorkspaceChange && onWorkspaceChange(e.target.value)}
        aria-label="Select Workspace"
      />
    </div>
  );
};
