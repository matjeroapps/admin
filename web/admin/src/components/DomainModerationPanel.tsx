import React from 'react';
import { messages, directionFor, type Locale } from '../i18n/locales';

export type StoreContext = {
  id: string;
  seller_id: string;
  code: string;
  name: string;
};

export type SellerContext = {
  id: string;
  code: string;
  name: string;
};

export type StoreDomain = {
  id: string;
  store_id: string;
  domain: string;
  is_primary: boolean;
  verified_at?: string | null;
  status: string;
  domain_type?: string;
  last_checked_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiClient = {
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
};

export type DomainModerationPanelProps = {
  api: ApiClient;
  stores: StoreContext[];
  sellers: SellerContext[];
  locale: Locale;
};

export function DomainModerationPanel({ api, stores, sellers, locale }: DomainModerationPanelProps) {
  const copy = messages[locale];
  const isRtl = directionFor(locale) === 'rtl';

  const [domains, setDomains] = React.useState<StoreDomain[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [sellerFilter, setSellerFilter] = React.useState('');
  const [storeFilter, setStoreFilter] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const limit = 25;

  // Pending action dialog state
  const [pendingAction, setPendingAction] = React.useState<{
    domain: StoreDomain;
    type: 'disable' | 'enable';
  } | null>(null);
  const [actionInFlightDomainId, setActionInFlightDomainId] = React.useState<string | null>(null);

  // Stale request isolation guard
  const requestGenRef = React.useRef(0);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Lookup helpers
  const storeMap = React.useMemo(() => {
    const map = new Map<string, StoreContext>();
    for (const s of stores) map.set(s.id, s);
    return map;
  }, [stores]);

  const sellerMap = React.useMemo(() => {
    const map = new Map<string, SellerContext>();
    for (const s of sellers) map.set(s.id, s);
    return map;
  }, [sellers]);

  const loadDomains = React.useCallback(async (preserveError = false) => {
    const currentGen = ++requestGenRef.current;
    setLoading(true);
    if (!preserveError) {
      setError(null);
    }

    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(offset));
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (statusFilter) query.set('status', statusFilter);
    if (typeFilter) query.set('domain_type', typeFilter);
    if (sellerFilter) query.set('seller_id', sellerFilter);
    if (storeFilter) query.set('store_id', storeFilter);

    try {
      const res = await api.get(`/v1/admin/domains?${query.toString()}`);
      if (currentGen !== requestGenRef.current) return;

      if (!res.ok) {
        throw new Error(`Failed to load domains (${res.status})`);
      }
      const data = (await res.json()) as { items: StoreDomain[] };
      if (currentGen === requestGenRef.current) {
        setDomains(data.items || []);
      }
    } catch (err) {
      if (currentGen === requestGenRef.current) {
        setError(err instanceof Error ? err.message : copy.moderationFailed);
      }
    } finally {
      if (currentGen === requestGenRef.current) {
        setLoading(false);
      }
    }
  }, [api, limit, offset, debouncedSearch, statusFilter, typeFilter, sellerFilter, storeFilter, copy.moderationFailed]);

  React.useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setSellerFilter('');
    setStoreFilter('');
    setOffset(0);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { domain, type } = pendingAction;
    setPendingAction(null);
    setActionInFlightDomainId(domain.id);
    setError(null);

    try {
      const path = `/v1/admin/domains/${encodeURIComponent(domain.id)}/${type}`;
      const res = await api.post(path);

      if (res.status === 409) {
        setError(copy.domainStateChanged);
        await loadDomains(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`${copy.moderationFailed} (${res.status})`);
      }

      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.moderationFailed);
    } finally {
      setActionInFlightDomainId(null);
    }
  };

  function getStatusClass(status: string) {
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
        return 'badge badge-active';
      case 'verified':
        return 'badge badge-verified';
      case 'pending':
        return 'badge badge-pending';
      case 'disabled':
        return 'badge badge-disabled';
      case 'failed':
        return 'badge badge-failed';
      default:
        return `badge badge-${s}`;
    }
  }

  return (
    <section className="panel" data-testid="domain-moderation-panel">
      <div className="panel-head">
        <div>
          <h2>{copy.domainsTitle}</h2>
          <p>{copy.domainsSubtitle}</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="domain-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 0' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="input"
          style={{ minWidth: '180px', flex: '1' }}
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          aria-label={copy.statusLabel}
          className="select"
        >
          <option value="">{`${copy.statusLabel}: ${copy.all}`}</option>
          <option value="pending">{copy.pending}</option>
          <option value="verified">{copy.verified}</option>
          <option value="active">{copy.active}</option>
          <option value="failed">{copy.failed}</option>
          <option value="disabled">{copy.disabled}</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}
          aria-label={copy.domainTypeLabel}
          className="select"
        >
          <option value="">{`${copy.domainTypeLabel}: ${copy.all}`}</option>
          <option value="platform">{copy.platform}</option>
          <option value="custom">{copy.custom}</option>
        </select>

        {sellers.length > 0 ? (
          <select
            value={sellerFilter}
            onChange={(e) => { setSellerFilter(e.target.value); setOffset(0); }}
            aria-label={copy.sellerLabel}
            className="select"
          >
            <option value="">{`${copy.sellerLabel}: ${copy.all}`}</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={sellerFilter}
            onChange={(e) => { setSellerFilter(e.target.value); setOffset(0); }}
            placeholder={copy.sellerLabel}
            aria-label={copy.sellerLabel}
            className="input"
          />
        )}

        {stores.length > 0 ? (
          <select
            value={storeFilter}
            onChange={(e) => { setStoreFilter(e.target.value); setOffset(0); }}
            aria-label={copy.storeLabel}
            className="select"
          >
            <option value="">{`${copy.storeLabel}: ${copy.all}`}</option>
            {stores.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.code})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={storeFilter}
            onChange={(e) => { setStoreFilter(e.target.value); setOffset(0); }}
            placeholder={copy.storeLabel}
            aria-label={copy.storeLabel}
            className="input"
          />
        )}

        <button type="button" onClick={clearFilters} className="button-secondary" aria-label={copy.clearFilters}>
          {copy.clearFilters}
        </button>
      </div>

      {/* Notifications / Errors */}
      <div aria-live="polite">
        {error ? (
          <div className="notice notice-error" style={{ marginBottom: '1rem' }} data-testid="domain-error">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="notice" style={{ marginBottom: '1rem' }} data-testid="domain-loading">
            {copy.status}
          </div>
        ) : null}
      </div>

      {/* List / Empty State */}
      {!loading && domains.length === 0 ? (
        <div className="empty-state" data-testid="domain-empty">
          {copy.noDomainsFound}
        </div>
      ) : (
        <div className="stack" data-testid="domain-list">
          {domains.map((dom) => {
            const store = storeMap.get(dom.store_id);
            const seller = store ? sellerMap.get(store.seller_id) : undefined;
            const storeLabel = store ? `${store.name} (${store.code})` : `${copy.storeLabel}: ${dom.store_id.slice(0, 8)}`;
            const sellerLabel = seller ? `${seller.name} (${seller.code})` : null;

            const isActionInProgress = actionInFlightDomainId === dom.id;

            return (
              <article key={dom.id} className="row-card" data-testid={`domain-card-${dom.id}`}>
                <div className="row-copy">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong dir="ltr" style={{ fontSize: '1.05rem' }}>
                      {dom.domain}
                    </strong>
                    {dom.is_primary ? (
                      <span className="pill pill-primary">{copy.primary}</span>
                    ) : (
                      <span className="pill">{copy.secondary}</span>
                    )}
                    {dom.domain_type ? (
                      <span className="pill">{dom.domain_type === 'platform' ? copy.platform : copy.custom}</span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    <span>{storeLabel}</span>
                    {sellerLabel ? <span> · {copy.sellerLabel}: {sellerLabel}</span> : null}
                  </div>

                  {(dom.verified_at || dom.last_checked_at) ? (
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                      {dom.verified_at ? <span>{copy.verified}: {new Date(dom.verified_at).toLocaleString()} </span> : null}
                      {dom.last_checked_at ? <span> · {copy.statusLabel}: {new Date(dom.last_checked_at).toLocaleString()}</span> : null}
                    </div>
                  ) : null}
                </div>

                <div className="row-side" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={getStatusClass(dom.status)}>
                    {dom.status === 'disabled'
                      ? copy.disabled
                      : dom.status === 'active'
                      ? copy.active
                      : dom.status === 'verified'
                      ? copy.verified
                      : dom.status === 'pending'
                      ? copy.pending
                      : dom.status === 'failed'
                      ? copy.failed
                      : dom.status}
                  </span>

                  {dom.status === 'disabled' ? (
                    <button
                      type="button"
                      disabled={isActionInProgress}
                      onClick={() => setPendingAction({ domain: dom, type: 'enable' })}
                      className="button"
                      data-testid={`enable-btn-${dom.id}`}
                    >
                      {copy.enable}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isActionInProgress}
                      onClick={() => setPendingAction({ domain: dom, type: 'disable' })}
                      className="button-secondary"
                      data-testid={`disable-btn-${dom.id}`}
                    >
                      {copy.disable}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #eee)' }}>
        <button
          type="button"
          disabled={offset === 0 || loading}
          onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          className="button-secondary"
          data-testid="pagination-prev"
        >
          {copy.previous}
        </button>

        <span style={{ fontSize: '0.875rem', color: '#666' }}>
          {offset + 1} - {offset + domains.length}
        </span>

        <button
          type="button"
          disabled={domains.length < limit || loading}
          onClick={() => setOffset((prev) => prev + limit)}
          className="button-secondary"
          data-testid="pagination-next"
        >
          {copy.next}
        </button>
      </div>

      {/* Confirmation Dialog Modal */}
      {pendingAction ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            className="modal-card"
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              direction: isRtl ? 'rtl' : 'ltr'
            }}
            data-testid="confirm-dialog"
          >
            <h3 id="confirm-dialog-title" style={{ marginTop: 0 }}>
              {pendingAction.type === 'disable' ? copy.confirmDisableTitle : copy.confirmEnableTitle}
            </h3>
            <p style={{ margin: '1rem 0', color: '#444', lineHeight: 1.5 }}>
              {pendingAction.type === 'disable' ? copy.confirmDisableBody : copy.confirmEnableBody}
            </p>
            <div style={{ fontWeight: 600, margin: '0.5rem 0 1.5rem 0' }} dir="ltr">
              {pendingAction.domain.domain}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="button-secondary"
                data-testid="confirm-cancel"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAction()}
                className="button"
                data-testid="confirm-submit"
              >
                {copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
