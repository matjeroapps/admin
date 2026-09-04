import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DomainModerationPanel, type StoreContext, type SellerContext, type StoreDomain } from './DomainModerationPanel';

const sampleStores: StoreContext[] = [
  { id: 'store-100', seller_id: 'seller-200', code: 'STO1', name: 'Alpha Store' }
];

const sampleSellers: SellerContext[] = [
  { id: 'seller-200', code: 'SEL1', name: 'Beta Seller' }
];

describe('DomainModerationPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('handles overlapping search requests deterministically with fake timers', async () => {
    vi.useFakeTimers();
    try {
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      const searchInput = screen.getByPlaceholderText('Search hostnames');

      // Trigger Search A
      fireEvent.change(searchInput, { target: { value: 'A' } });

      // Advance debounce by 300ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=A'));

      // Trigger Search B
      fireEvent.change(searchInput, { target: { value: 'B' } });

      // Advance debounce by 300ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=B'));

      // Resolve B first
      await act(async () => {
        resolveSearchB({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: true, status: 'active', created_at: '', updated_at: '' }
            ]
          })
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('domain-B.com')).toBeDefined();

      // Resolve A late
      await act(async () => {
        resolveSearchA({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { id: 'dom-A', store_id: 'store-100', domain: 'domain-A-LEAK.com', is_primary: false, status: 'active', created_at: '', updated_at: '' }
            ]
          })
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByText('domain-A-LEAK.com')).toBeNull();
      expect(screen.getByText('domain-B.com')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('prevents stale action from reloading or overwriting when view changes before POST completes', async () => {
    let resolvePostA: (val: any) => void = () => {};
    let resolveGetB: (val: any) => void = () => {};

    const postAPromise = new Promise((resolve) => { resolvePostA = resolve; });
    const getBPromise = new Promise((resolve) => { resolveGetB = resolve; });

    const domainA: StoreDomain = {
      id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
    };
    const domainB: StoreDomain = {
      id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: false, status: 'disabled', domain_type: 'custom', created_at: '', updated_at: ''
    };

    const mockApi = {
      get: vi.fn().mockImplementation((path: string) => {
        if (path.includes('status=disabled')) {
          return getBPromise;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [domainA] })
        });
      }),
      post: vi.fn().mockImplementation(() => postAPromise)
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    // Render View A (status="")
    await waitFor(() => expect(screen.getByText('domain-A.com')).toBeDefined());

    // Click Disable on domain A
    fireEvent.click(screen.getByTestId('disable-btn-dom-A'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/disable'));

    // Switch to View B by changing status filter to "disabled"
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'disabled' } });

    // Resolve B GET call
    await act(async () => {
      resolveGetB({
        ok: true,
        status: 200,
        json: async () => ({ items: [domainB] })
      });
    });

    // Assert View B data visible
    await waitFor(() => {
      expect(screen.getByText('domain-B.com')).toBeDefined();
      expect(screen.queryByText('domain-A.com')).toBeNull();
    });

    const getCallCountBeforePostResolve = mockApi.get.mock.calls.length;

    // Now resolve old View A POST
    await act(async () => {
      resolvePostA({
        ok: true,
        status: 200,
        json: async () => ({ ...domainA, status: 'disabled' })
      });
    });

    expect(screen.getByText('domain-B.com')).toBeDefined();
    expect(screen.queryByText('domain-A.com')).toBeNull();
    expect(mockApi.get.mock.calls.length).toBe(getCallCountBeforePostResolve);
    expect(screen.queryByTestId('domain-error')).toBeNull();
  });

  it('ignores 409 conflict notice and reload when view changed before action returned 409', async () => {
    let resolvePost409: (val: any) => void = () => {};
    let resolveGetB: (val: any) => void = () => {};

    const post409Promise = new Promise((resolve) => { resolvePost409 = resolve; });
    const getBPromise = new Promise((resolve) => { resolveGetB = resolve; });

    const domainA: StoreDomain = {
      id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'disabled', domain_type: 'custom', created_at: '', updated_at: ''
    };
    const domainB: StoreDomain = {
      id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: false, status: 'verified', domain_type: 'custom', created_at: '', updated_at: ''
    };

    const mockApi = {
      get: vi.fn().mockImplementation((path: string) => {
        if (path.includes('status=verified')) {
          return getBPromise;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [domainA] })
        });
      }),
      post: vi.fn().mockImplementation(() => post409Promise)
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('domain-A.com')).toBeDefined());

    // Start Enable on domain A
    fireEvent.click(screen.getByTestId('enable-btn-dom-A'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/enable'));

    // Switch to View B (status=verified)
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'verified' } });

    // Resolve B GET
    await act(async () => {
      resolveGetB({
        ok: true,
        status: 200,
        json: async () => ({ items: [domainB] })
      });
    });

    await waitFor(() => expect(screen.getByText('domain-B.com')).toBeDefined());

    const getCallCountBefore409 = mockApi.get.mock.calls.length;

    // Resolve old action with 409
    await act(async () => {
      resolvePost409({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'conflict', message: 'domain state changed' } })
      });
    });

    expect(screen.getByText('domain-B.com')).toBeDefined();
    expect(screen.queryByTestId('domain-error')).toBeNull();
    expect(mockApi.get.mock.calls.length).toBe(getCallCountBefore409);
  });

  it('allows entering arbitrary Seller ID and Store ID not in props context', async () => {
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

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

    const sellerInput = screen.getByTestId('seller-filter-input');
    fireEvent.change(sellerInput, { target: { value: 'seller-999' } });

    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('seller_id=seller-999');
    });

    const storeInput = screen.getByTestId('store-filter-input');
    fireEvent.change(storeInput, { target: { value: 'store-999' } });

    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('store_id=store-999');
      expect(lastCall).toContain('seller_id=seller-999');
    });
  });

  it('sends exact ID when selecting/typing known suggestion', async () => {
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

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

    const sellerInput = screen.getByTestId('seller-filter-input');
    fireEvent.change(sellerInput, { target: { value: 'seller-200' } });

    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('seller_id=seller-200');
      expect(lastCall).not.toContain('Beta');
    });
  });

  it('proves all query parameters and offset reset on filter changes', async () => {
    const mockApi = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: Array(25).fill(null).map((_, i) => ({
          id: `dom-${i}`, store_id: 's-1', domain: `d${i}.com`, is_primary: false, status: 'active', created_at: '', updated_at: ''
        })) })
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

    // Advance to next page (offset=25)
    fireEvent.click(screen.getByTestId('pagination-next'));

    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('offset=25');
    });

    // Change status filter -> offset should reset to 0
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('status=pending');
      expect(lastCall).toContain('offset=0');
      expect(lastCall).toContain('limit=25');
    });
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

  it('unlocks stale action button when returning to view after action finishes out-of-view', async () => {
    let resolvePostA: (val: any) => void = () => {};
    let resolveGetB: (val: any) => void = () => {};

    const postAPromise = new Promise((resolve) => { resolvePostA = resolve; });
    const getBPromise = new Promise((resolve) => { resolveGetB = resolve; });

    const domainA: StoreDomain = {
      id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
    };
    const domainB: StoreDomain = {
      id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: false, status: 'disabled', domain_type: 'custom', created_at: '', updated_at: ''
    };

    const mockApi = {
      get: vi.fn().mockImplementation((path: string) => {
        if (path.includes('status=disabled')) {
          return getBPromise;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [domainA] })
        });
      }),
      post: vi.fn().mockImplementation(() => postAPromise)
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('domain-A.com')).toBeDefined());

    // Start Disable on domain A
    fireEvent.click(screen.getByTestId('disable-btn-dom-A'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/disable'));

    // Switch view to status=disabled
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'disabled' } });

    // Resolve B GET call
    await act(async () => {
      resolveGetB({
        ok: true,
        status: 200,
        json: async () => ({ items: [domainB] })
      });
    });

    await waitFor(() => expect(screen.getByText('domain-B.com')).toBeDefined());

    // Resolve old Post A while on View B
    await act(async () => {
      resolvePostA({
        ok: true,
        status: 200,
        json: async () => ({ ...domainA, status: 'disabled' })
      });
    });

    // Switch back to View A (all status)
    fireEvent.change(statusSelect, { target: { value: '' } });

    await waitFor(() => expect(screen.getByText('domain-A.com')).toBeDefined());

    // Domain A action button MUST be enabled
    const disableBtn = screen.getByTestId('disable-btn-dom-A') as HTMLButtonElement;
    expect(disableBtn.disabled).toBe(false);
  });

  it('handles two concurrent pending domain actions independently', async () => {
    let resolvePostA: (val: any) => void = () => {};
    let resolvePostB: (val: any) => void = () => {};

    const postAPromise = new Promise((resolve) => { resolvePostA = resolve; });
    const postBPromise = new Promise((resolve) => { resolvePostB = resolve; });

    const domainA: StoreDomain = {
      id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
    };
    const domainB: StoreDomain = {
      id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: false, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
    };

    const mockApi = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [domainA, domainB] })
      }),
      post: vi.fn().mockImplementation((path: string) => {
        if (path.includes('dom-A')) return postAPromise;
        if (path.includes('dom-B')) return postBPromise;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
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

    await waitFor(() => {
      expect(screen.getByText('domain-A.com')).toBeDefined();
      expect(screen.getByText('domain-B.com')).toBeDefined();
    });

    // Disable A
    fireEvent.click(screen.getByTestId('disable-btn-dom-A'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/disable'));

    // Disable B
    fireEvent.click(screen.getByTestId('disable-btn-dom-B'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-B/disable'));

    const btnA = screen.getByTestId('disable-btn-dom-A') as HTMLButtonElement;
    const btnB = screen.getByTestId('disable-btn-dom-B') as HTMLButtonElement;

    expect(btnA.disabled).toBe(true);
    expect(btnB.disabled).toBe(true);

    // Resolve A only
    await act(async () => {
      resolvePostA({
        ok: true,
        status: 200,
        json: async () => ({ ...domainA, status: 'disabled' })
      });
    });

    // A should unlock, B MUST remain disabled
    await waitFor(() => expect(btnA.disabled).toBe(false));
    expect(btnB.disabled).toBe(true);

    // Resolve B
    await act(async () => {
      resolvePostB({
        ok: true,
        status: 200,
        json: async () => ({ ...domainB, status: 'disabled' })
      });
    });

    // B should now unlock
    await waitFor(() => expect(btnB.disabled).toBe(false));
  });

  it('invalidates view synchronously on user input before passive effects run', async () => {
    let resolvePostA: (val: any) => void = () => {};
    const postAPromise = new Promise((resolve) => { resolvePostA = resolve; });

    const domainA: StoreDomain = {
      id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
    };

    const mockApi = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [domainA] })
      }),
      post: vi.fn().mockImplementation(() => postAPromise)
    };

    render(
      <DomainModerationPanel
        api={mockApi}
        stores={sampleStores}
        sellers={sampleSellers}
        locale="en"
      />
    );

    await waitFor(() => expect(screen.getByText('domain-A.com')).toBeDefined());

    // Start action on domain A
    fireEvent.click(screen.getByTestId('disable-btn-dom-A'));
    fireEvent.click(screen.getByTestId('confirm-submit'));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/disable'));

    // Trigger raw search input change (synchronous invalidation)
    const searchInput = screen.getByPlaceholderText('Search hostnames');
    fireEvent.change(searchInput, { target: { value: 'instant-search' } });

    const getCallCountBeforePostResolve = mockApi.get.mock.calls.length;

    // Immediately resolve Post A within the same interaction flow
    await act(async () => {
      resolvePostA({
        ok: true,
        status: 200,
        json: async () => ({ ...domainA, status: 'disabled' })
      });
    });

    // Action A was already stale: no reloads triggered by Post A resolve
    expect(mockApi.get.mock.calls.length).toBe(getCallCountBeforePostResolve);
    expect(screen.queryByTestId('domain-error')).toBeNull();
  });

  it('prevents action started during search debounce window from resurrecting pre-search view when debounce commits', async () => {
    vi.useFakeTimers();
    try {
      let resolvePostA: (val: any) => void = () => {};
      let resolveGetSearchB: (val: any) => void = () => {};

      const postAPromise = new Promise((resolve) => { resolvePostA = resolve; });
      const getSearchBPromise = new Promise((resolve) => { resolveGetSearchB = resolve; });

      const domainA: StoreDomain = {
        id: 'dom-A', store_id: 'store-100', domain: 'domain-A.com', is_primary: true, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
      };
      const domainB: StoreDomain = {
        id: 'dom-B', store_id: 'store-100', domain: 'domain-B.com', is_primary: false, status: 'active', domain_type: 'custom', created_at: '', updated_at: ''
      };

      const mockApi = {
        get: vi.fn().mockImplementation((path: string) => {
          if (path.includes('search=B')) {
            return getSearchBPromise;
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ items: [domainA] })
          });
        }),
        post: vi.fn().mockImplementation(() => postAPromise)
      };

      render(
        <DomainModerationPanel
          api={mockApi}
          stores={sampleStores}
          sellers={sampleSellers}
          locale="en"
        />
      );

      // Initial load View A
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('domain-A.com')).toBeDefined();

      const searchInput = screen.getByPlaceholderText('Search hostnames');

      // Type Search B into raw input
      fireEvent.change(searchInput, { target: { value: 'B' } });

      // DO NOT advance timer by 300ms yet! Start Disable(A) immediately during debounce window
      fireEvent.click(screen.getByTestId('disable-btn-dom-A'));
      fireEvent.click(screen.getByTestId('confirm-submit'));

      expect(mockApi.post).toHaveBeenCalledWith('/v1/admin/domains/dom-A/disable');

      // Now advance debounce by 300ms so debouncedSearch commits to 'B'
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=B'));

      // Resolve GET search=B
      await act(async () => {
        resolveGetSearchB({
          ok: true,
          status: 200,
          json: async () => ({ items: [domainB] })
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Assert View B is rendered
      expect(screen.getByText('domain-B.com')).toBeDefined();
      expect(screen.queryByText('domain-A.com')).toBeNull();

      const getCallCountBeforePostAResolve = mockApi.get.mock.calls.length;

      // Now resolve the old POST A that started during debounce window
      await act(async () => {
        resolvePostA({
          ok: true,
          status: 200,
          json: async () => ({ ...domainA, status: 'disabled' })
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Assert View B remains authoritative and Domain A does NOT return
      expect(screen.getByText('domain-B.com')).toBeDefined();
      expect(screen.queryByText('domain-A.com')).toBeNull();
      // NO GET with pre-search filters was triggered by POST A completion
      expect(mockApi.get.mock.calls.length).toBe(getCallCountBeforePostAResolve);
      expect(screen.queryByTestId('domain-error')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
