import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  DashboardLayout,
  LoadingState,
  EmptyState,
  ErrorState,
  UnauthorizedState,
  AnonymousState,
  AuthenticatedState,
  sellerNavigation,
} from '../src/index.js';

describe('MatjerHub Shell & States Components', () => {
  it('renders DashboardLayout with navigation items and children', () => {
    render(
      <DashboardLayout navItems={sellerNavigation} currentPath="/dashboard">
        <div data-testid="dashboard-content">Dashboard Main Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('renders Shell States: Loading, Empty, Error, Unauthorized', () => {
    const { rerender } = render(<LoadingState title="Fetching records..." />);
    expect(screen.getByText('Fetching records...')).toBeInTheDocument();

    rerender(<EmptyState title="No orders found" description="Create your first order to get started." />);
    expect(screen.getByText('No orders found')).toBeInTheDocument();

    rerender(<ErrorState title="System Timeout" message="Database query timed out." />);
    expect(screen.getByText('System Timeout')).toBeInTheDocument();

    rerender(<UnauthorizedState title="Restricted Access" message="Admin privileges required." />);
    expect(screen.getByText('Restricted Access')).toBeInTheDocument();
  });

  it('renders Auth UX States: Anonymous & Authenticated', () => {
    const { rerender } = render(<AnonymousState appName="Seller Portal" />);
    expect(screen.getByText('Sign in to Seller Portal')).toBeInTheDocument();

    rerender(
      <AuthenticatedState
        user={{ name: 'Jane Admin', email: 'jane@matjerhub.com', role: 'Super Admin', tenantId: 'tenant-123' }}
      />
    );
    expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    expect(screen.getByText('tenant-123')).toBeInTheDocument();
  });
});
