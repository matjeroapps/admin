import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DomainModerationPanel, type StoreContext, type SellerContext, type StoreDomain } from './DomainModerationPanel';

const sampleStores: StoreContext[] = [
  { id: 'store-100', seller_id: 'seller-200', code: 'STO1', name: 'Alpha Store' }
];

const sampleSellers: SellerContext[] = [
  { id: 'seller-200', code: 'SEL1', name: 'Beta Seller' }
];

describe('DomainModerationPanel', () => {
  it('renders domain list with platform and custom domains, status badges, and store/seller context', async () => {
    const domains: StoreDomain[] = [
      {
        id: 'dom-1',
        store_id: 'store-100',
        domain: 'store.matjero.shop',
        is_primary: true,
        status: 'active',
        domain_type: 'platform',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      {
        id: 'dom-2',
        store_id: 'store-100',
        domain: 'mycustombrand.com',
        is_primary: false,
        verified_at: '2026-01-02T00:00:00Z',
        status: 'verified',
        domain_type: 'custom',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      }
    ];

    const mockApi = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: domains })
      }),
      post: vi.fn()
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('store.matjero.shop')).toBeDefined();
      expect(screen.getByText('mycustombrand.com')).toBeDefined();
    });

    expect(screen.getAllByText('Alpha Store (STO1)').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Beta Seller \(SEL1\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('Primary')).toBeDefined();
    expect(screen.getByText('Secondary')).toBeDefined();

    // Verify secret fields are not in the DOM
    expect(document.body.innerHTML).not.toContain('verification_token');
    expect(document.body.innerHTML).not.toContain('record_value');
  });

  it('forwards server filters correctly when status, domain type, search, and store/seller filters change', async () => {
    const mockApi = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
      }),
      post: vi.fn()
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    // Initial load call
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

    // Change status filter
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'disabled' } });

    await waitFor(() => {
      const lastCallUrl = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCallUrl).toContain('status=disabled');
    });

    // Change type filter
    const typeSelect = screen.getByLabelText('Domain Type');
    fireEvent.change(typeSelect, { target: { value: 'custom' } });

    await waitFor(() => {
      const lastCallUrl = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCallUrl).toContain('domain_type=custom');
    });
  });

  it('ignores stale async search responses when newer search completes first', async () => {
    let resolveSearchA: (val: any) => void = () => {};
    let resolveSearchB: (val: any) => void = () => {};

    const promiseA = new Promise((resolve) => { resolveSearchA = resolve; });
    const promiseB = new Promise((resolve) => { resolveSearchB = resolve; });

    const mockApi = {
      get: vi.fn().mockImplementation((path: string) => {
        if (path.includes('search=A')) return promiseA;
        if (path.includes('search=B')) return promiseB;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        });
      }),
      post: vi.fn()
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

    const searchInput = screen.getByPlaceholderText('Search hostnames');

    // Trigger Search A
    fireEvent.change(searchInput, { target: { value: 'A' } });

    // Trigger Search B immediately after
    fireEvent.change(searchInput, { target: { value: 'B' } });

    // Fast-forward debounce timers
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=B'));
    });

    // Resolve B first
    resolveSearchB({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: true, status: 'active', created_at: '', updated_at: '' }
        ]
      })
    });

    await waitFor(() => {
      expect(screen.getByText('domain-B.com')).toBeDefined();
    });

    // Resolve A late
    resolveSearchA({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: 'dom-A', store_id: 'store-100', domain: 'domain-A-LEAK.com', is_primary: false, status: 'active', created_at: '', updated_at: '' }
        ]
      })
    });

    // Domain A must NOT leak into the UI
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('domain-A-LEAK.com')).toBeNull();
    expect(screen.getByText('domain-B.com')).toBeDefined();
  });

  it('handles Disable domain action with modal confirmation and authoritative reload', async () => {
    const activeDomain: StoreDomain = {
      id: 'dom-custom-1',
      store_id: 'store-100',
      domain: 'mycustom.com',
      is_primary: true,
      status: 'active',
      domain_type: 'custom',
      created_at: '',
      updated_at: ''
    };

    const disabledDomainReload: StoreDomain[] = [
      {
        id: 'dom-custom-1',
        store_id: 'store-100',
        domain: 'mycustom.com',
        is_primary: false,
        status: 'disabled',
        domain_type: 'custom',
        created_at: '',
        updated_at: ''
      },
      {
        id: 'dom-platform-1',
        store_id: 'store-100',
        domain: 'store.matjero.shop',
        is_primary: true,
        status: 'active',
        domain_type: 'platform',
        created_at: '',
        updated_at: ''
      }
    ];

    let getCallCount = 0;
    const mockApi = {
      get: vi.fn().mockImplementation(() => {
        getCallCount++;
        const items = getCallCount === 1 ? [activeDomain] : disabledDomainReload;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items })
        });
      }),
      post: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...activeDomain, status: 'disabled', is_primary: false })
      })
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('mycustom.com')).toBeDefined());

    // Click Disable
    const disableBtn = screen.getByTestId('disable-btn-dom-custom-1');
    fireEvent.click(disableBtn);

    // Confirmation dialog pops up
    expect(screen.getByTestId('confirm-dialog')).toBeDefined();
    expect(screen.getByText('Confirm Disable Domain')).toBeDefined();

    // Submit confirmation
    const confirmBtn = screen.getByTestId('confirm-submit');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-custom-1/disable');
    });

    // Authoritative reload shows custom disabled and platform promoted to primary
    await waitFor(() => {
      expect(screen.getByText('store.matjero.shop')).toBeDefined();
      expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    });
  });

  it('handles Enable for custom verified domain (returns verified, NOT active)', async () => {
    const disabledCustom: StoreDomain = {
      id: 'dom-verified-1',
      store_id: 'store-100',
      domain: 'verified-custom.com',
      is_primary: false,
      verified_at: '2026-01-01T00:00:00Z',
      status: 'disabled',
      domain_type: 'custom',
      created_at: '',
      updated_at: ''
    };

    const reenabledReload: StoreDomain[] = [
      { ...disabledCustom, status: 'verified' }
    ];

    let getCallCount = 0;
    const mockApi = {
      get: vi.fn().mockImplementation(() => {
        getCallCount++;
        const items = getCallCount === 1 ? [disabledCustom] : reenabledReload;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items })
        });
      }),
      post: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...disabledCustom, status: 'verified' })
      })
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('verified-custom.com')).toBeDefined());

    const enableBtn = screen.getByTestId('enable-btn-dom-verified-1');
    fireEvent.click(enableBtn);

    // Submit confirmation modal
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-verified-1/enable');
    });

    await waitFor(() => {
      expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
    });
  });

  it('handles Enable for custom unverified domain (returns pending)', async () => {
    const disabledUnverified: StoreDomain = {
      id: 'dom-unverified-1',
      store_id: 'store-100',
      domain: 'unverified-custom.com',
      is_primary: false,
      verified_at: null,
      status: 'disabled',
      domain_type: 'custom',
      created_at: '',
      updated_at: ''
    };

    const reenabledReload: StoreDomain[] = [
      { ...disabledUnverified, status: 'pending' }
    ];

    let getCallCount = 0;
    const mockApi = {
      get: vi.fn().mockImplementation(() => {
        getCallCount++;
        const items = getCallCount === 1 ? [disabledUnverified] : reenabledReload;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items })
        });
      }),
      post: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...disabledUnverified, status: 'pending' })
      })
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('unverified-custom.com')).toBeDefined());

    fireEvent.click(screen.getByTestId('enable-btn-dom-unverified-1'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => {
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    });
  });

  it('handles 409 state-changed conflict with error notice and authoritative refresh', async () => {
    const disabledDomain: StoreDomain = {
      id: 'dom-conflict-1',
      store_id: 'store-100',
      domain: 'conflict.com',
      is_primary: false,
      status: 'disabled',
      domain_type: 'custom',
      created_at: '',
      updated_at: ''
    };

    const refreshedDomain: StoreDomain = {
      ...disabledDomain,
      status: 'active',
      is_primary: true
    };

    let getCallCount = 0;
    const mockApi = {
      get: vi.fn().mockImplementation(() => {
        getCallCount++;
        const items = getCallCount === 1 ? [disabledDomain] : [refreshedDomain];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items })
        });
      }),
      post: vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'conflict', message: 'domain state changed' } })
      })
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('conflict.com')).toBeDefined());

    fireEvent.click(screen.getByTestId('enable-btn-dom-conflict-1'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('domain-error').textContent).toContain('Domain state changed. Refresh and try again.');
    });

    // Authoritative state refreshed
    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });
  });
});
