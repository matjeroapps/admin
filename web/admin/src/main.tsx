import React from 'react';
import { createRoot } from 'react-dom/client';
import { createApiClient } from './lib/api';
import { directionFor, messages, type Locale } from './i18n/locales';
import { createOidcAuthClient, type AuthClient, type AuthState } from './auth/oidc';
import { DomainModerationPanel } from './components/DomainModerationPanel';
import './styles.css';

type Bootstrap = {
  app: string;
  actor: string;
  locale: Locale;
  direction: 'rtl' | 'ltr';
  markets: Array<{ code: string; country: { name: string }; currency: { code: string } }>;
  principal?: { subject: string; roles: string[]; preferred_username?: string };
};

type PageResponse<T> = { items: T[] };
type CountResponse = { counts: Record<string, number> };

type Supplier = { id: string; code: string; name: string; status: string; created_at: string; updated_at: string };
type Seller = { id: string; code: string; name: string; status: string; created_at: string; updated_at: string };
type Store = { id: string; seller_id: string; market_code: string; code: string; name: string; status: string; created_at: string; updated_at: string };
type Product = { id: string; slug: string; status: string; created_at: string; updated_at: string };
type Category = { id: string; slug: string; status: string; created_at: string; updated_at: string };
type SupplierOffer = { offer_id?: string; id?: string; market_code: string; product_id?: string; supplier_id?: string; supplier_name?: string; product_name?: string; supplier_code?: string; status: string; price?: { amount_minor: number; currency: string } | null; is_available?: boolean | null };
type SellerListing = { id: string; store_id: string; product_id: string; market_code: string; status: string };
type FulfillmentLocation = { id: string; supplier_id: string; market_code: string; code: string; name: string; location_type: string; status: string };

const locale = (new URLSearchParams(window.location.search).get('locale') === 'ar' ? 'ar' : 'en') satisfies Locale;
const copy = messages[locale];

document.documentElement.lang = locale;
document.documentElement.dir = directionFor(locale);

function statusClass(status: string) {
  return `badge badge-${status.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

export const defaultAuthClient = createOidcAuthClient();

export function App({ authClient = defaultAuthClient }: { authClient?: AuthClient }) {
  const [authState, setAuthState] = React.useState<AuthState>(authClient.getState());
  const [isForbidden, setIsForbidden] = React.useState(false);
  const [callbackProcessing, setCallbackProcessing] = React.useState(false);
  const [callbackError, setCallbackError] = React.useState<string | null>(null);

  const [bootstrap, setBootstrap] = React.useState<Bootstrap | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [sellers, setSellers] = React.useState<Seller[]>([]);
  const [stores, setStores] = React.useState<Store[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [offers, setOffers] = React.useState<SupplierOffer[]>([]);
  const [listings, setListings] = React.useState<SellerListing[]>([]);
  const [locations, setLocations] = React.useState<FulfillmentLocation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [supplierStatus, setSupplierStatus] = React.useState('');
  const [sellerStatus, setSellerStatus] = React.useState('');

  const api = React.useMemo(() => {
    return createApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
      getAccessToken: () => authClient.getAccessToken(),
      renewToken: () => authClient.renewToken(),
      onUnauthorized: () => {
        void authClient.clearSession();
      },
      onForbidden: () => {
        setIsForbidden(true);
      }
    });
  }, [authClient]);

  React.useEffect(() => {
    const unsubscribe = authClient.subscribe((nextState) => {
      setAuthState(nextState);
      if (!nextState.isAuthenticated) {
        setIsForbidden(false);
      }
    });
    return unsubscribe;
  }, [authClient]);

  React.useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setCallbackProcessing(true);
      authClient
        .handleCallback(window.location.href)
        .then((returnPath) => {
          window.history.replaceState({}, document.title, returnPath);
          setCallbackProcessing(false);
        })
        .catch((err) => {
          window.history.replaceState({}, document.title, '/auth/callback');
          setCallbackProcessing(false);
          setCallbackError(err instanceof Error ? err.message : 'Callback processing failed');
        });
    }
  }, [authClient]);

  React.useEffect(() => {
    if (!authState.isAuthenticated || isForbidden || authState.isLoading) {
      return;
    }

    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [bootRes, overviewRes, suppliersRes, sellersRes, storesRes, productsRes, categoriesRes, offersRes, listingsRes, locationsRes] = await Promise.all([
          api.get(`/v1/bootstrap?locale=${locale}`),
          api.get(`/v1/admin/overview?locale=${locale}`),
          api.get(`/v1/admin/suppliers?locale=${locale}`),
          api.get(`/v1/admin/sellers?locale=${locale}`),
          api.get(`/v1/admin/stores?locale=${locale}`),
          api.get(`/v1/admin/products?locale=${locale}`),
          api.get(`/v1/admin/categories?locale=${locale}`),
          api.get(`/v1/admin/offers?locale=${locale}`),
          api.get(`/v1/admin/listings?locale=${locale}`),
          api.get(`/v1/admin/locations?locale=${locale}`)
        ]);

        if (!active) return;

        if (bootRes.status === 403 || overviewRes.status === 403) {
          setIsForbidden(true);
          return;
        }

        setBootstrap(await bootRes.json());
        setCounts(((await overviewRes.json()) as CountResponse).counts);
        setSuppliers(((await suppliersRes.json()) as PageResponse<Supplier>).items);
        setSellers(((await sellersRes.json()) as PageResponse<Seller>).items);
        setStores(((await storesRes.json()) as PageResponse<Store>).items);
        setProducts(((await productsRes.json()) as PageResponse<Product>).items);
        setCategories(((await categoriesRes.json()) as PageResponse<Category>).items);
        setOffers(((await offersRes.json()) as PageResponse<SupplierOffer>).items);
        setListings(((await listingsRes.json()) as PageResponse<SellerListing>).items);
        setLocations(((await locationsRes.json()) as PageResponse<FulfillmentLocation>).items);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authState.isAuthenticated, isForbidden, authState.isLoading, api]);

  async function refresh() {
    const response = await api.get(`/v1/admin/overview?locale=${locale}`);
    setCounts(((await response.json()) as CountResponse).counts);
  }

  async function updateStatus(path: string, status: string) {
    const response = await api.post(path, { status });
    if (!response.ok) {
      throw new Error(`Failed to update status (${response.status})`);
    }
    await refresh();
  }

  // 1. Auth Loading or Callback Processing State
  if (authState.isLoading || callbackProcessing) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">admin</p>
            <h1>{copy.appName}</h1>
          </div>
        </header>
        <div className="notice" data-testid="auth-loading">
          {copy.status ?? 'Authenticating...'}
        </div>
      </main>
    );
  }

  // 2. Configuration Error State (Production Fail-Closed)
  if (authState.error && authState.error.includes('Authentication configuration missing')) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">admin</p>
            <h1>{copy.appName}</h1>
          </div>
        </header>
        <div className="notice notice-error" data-testid="config-error">
          <strong>Authentication Configuration Error</strong>
          <p>{authState.error}</p>
        </div>
      </main>
    );
  }

  // 3. Callback Error / Auth Error State
  if (callbackError || (authState.error && !authState.isAuthenticated)) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">admin</p>
            <h1>{copy.appName}</h1>
          </div>
        </header>
        <div className="notice notice-error" data-testid="auth-error">
          <strong>Authentication Error</strong>
          <p>{callbackError || authState.error}</p>
          <button className="button" style={{ marginTop: '1rem' }} onClick={() => authClient.login()}>
            Try Again
          </button>
        </div>
      </main>
    );
  }

  // 4. Forbidden State (403 from Backend or Missing Role)
  if (isForbidden) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">admin</p>
            <h1>{copy.appName}</h1>
          </div>
          <div className="hero-meta">
            <span className="pill">{authState.user?.preferred_username ?? authState.user?.subject ?? 'anonymous'}</span>
            <button className="button-secondary" onClick={() => authClient.logout()}>
              Sign out
            </button>
          </div>
        </header>
        <div className="notice notice-error" data-testid="forbidden-state">
          <strong>Access Denied (403)</strong>
          <p>Platform Administrator authorization (RolePlatformAdmin) is required to access the Admin Console.</p>
        </div>
      </main>
    );
  }

  // 5. Unauthenticated State
  if (!authState.isAuthenticated) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">admin</p>
            <h1>{copy.appName}</h1>
            <p className="lede">Operational visibility across suppliers, sellers, stores, offers, listings, products, and inventory.</p>
          </div>
        </header>
        <section className="panel" data-testid="unauthenticated-state">
          <div className="panel-head">
            <div>
              <h2>Platform Administrator Authentication</h2>
              <p>Sign in to access operational administration.</p>
            </div>
          </div>
          <div style={{ padding: '1.5rem 0' }}>
            <button className="button" onClick={() => authClient.login()}>
              Sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  // 6. Authenticated State -> Dashboard
  return (
    <main className="app-shell" data-testid="authenticated-dashboard">
      <header className="hero">
        <div>
          <p className="eyebrow">{bootstrap?.actor ?? 'admin'}</p>
          <h1>{copy.appName}</h1>
          <p className="lede">Operational visibility across suppliers, sellers, stores, offers, listings, products, and inventory.</p>
        </div>
        <div className="hero-meta">
          <span className="pill">{bootstrap?.direction ?? directionFor(locale)}</span>
          <span className="pill">{bootstrap?.markets.length ?? 0} markets</span>
          <span className="pill">{authState.user?.preferred_username ?? bootstrap?.principal?.preferred_username ?? bootstrap?.principal?.subject ?? 'anonymous'}</span>
          <button className="button-secondary" onClick={() => authClient.logout()}>
            Sign out
          </button>
        </div>
      </header>

      {error ? <div className="notice notice-error">{error}</div> : null}
      {loading ? <div className="notice">{copy.status}</div> : null}

      <section className="summary-grid">
        {Object.entries(counts).map(([key, value]) => (
          <article key={key} className="summary-card">
            <span className="summary-label">{key}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <Panel title="Suppliers" subtitle="Inspect and moderate supplier records">
          <EntityList
            items={suppliers}
            renderItem={(supplier) => (
              <Row
                key={supplier.id}
                title={supplier.name}
                meta={`${supplier.code} · ${supplier.id.slice(0, 8)}`}
                status={supplier.status}
                action={
                  <InlineStatusForm
                    value={supplierStatus}
                    onChange={setSupplierStatus}
                    onSubmit={async () => updateStatus(`/v1/admin/suppliers/${supplier.id}/status?locale=${locale}`, supplierStatus)}
                  />
                }
              />
            )}
          />
        </Panel>

        <Panel title="Sellers" subtitle="Inspect seller ownership and lifecycle">
          <EntityList
            items={sellers}
            renderItem={(seller) => (
              <Row
                key={seller.id}
                title={seller.name}
                meta={`${seller.code} · ${seller.id.slice(0, 8)}`}
                status={seller.status}
                action={
                  <InlineStatusForm
                    value={sellerStatus}
                    onChange={setSellerStatus}
                    onSubmit={async () => updateStatus(`/v1/admin/sellers/${seller.id}/status?locale=${locale}`, sellerStatus)}
                  />
                }
              />
            )}
          />
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel title="Stores">
          <EntityList items={stores} renderItem={(store) => <Row key={store.id} title={store.name} meta={`${store.code} · market ${store.market_code}`} status={store.status} />} />
        </Panel>
        <Panel title="Offers">
          <EntityList items={offers} renderItem={(offer) => <Row key={offer.id ?? offer.offer_id ?? `${offer.market_code}-${offer.product_id}`} title={offer.product_name ?? 'Offer'} meta={`${offer.supplier_name ?? offer.supplier_code ?? 'supplier'} · ${offer.market_code}`} status={offer.status} />} />
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel title="Products">
          <EntityList items={products} renderItem={(product) => <Row key={product.id} title={product.slug} meta={product.id.slice(0, 8)} status={product.status} />} />
        </Panel>
        <Panel title="Categories">
          <EntityList items={categories} renderItem={(category) => <Row key={category.id} title={category.slug} meta={category.id.slice(0, 8)} status={category.status} />} />
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel title="Listings">
          <EntityList items={listings} renderItem={(listing) => <Row key={listing.id} title={listing.id} meta={`${listing.store_id} · ${listing.market_code}`} status={listing.status} />} />
        </Panel>
        <Panel title="Fulfillment Locations">
          <EntityList items={locations} renderItem={(location) => <Row key={location.id} title={location.name} meta={`${location.code} · ${location.market_code}`} status={location.status} />} />
        </Panel>
      </section>

      <DomainModerationPanel api={api} stores={stores} sellers={sellers} locale={locale} />
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function EntityList<T>({ items, renderItem }: { items: T[]; renderItem: (item: T) => React.ReactNode }) {
  if (items.length === 0) {
    return <div className="empty-state">No records yet.</div>;
  }
  return <div className="stack">{items.map(renderItem)}</div>;
}

function Row({ title, meta, status, action }: { title: string; meta: string; status: string; action?: React.ReactNode }) {
  return (
    <article className="row-card">
      <div className="row-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <div className="row-side">
        <span className={statusClass(status)}>{status}</span>
        {action}
      </div>
    </article>
  );
}

function InlineStatusForm({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => Promise<void> }) {
  return (
    <form
      className="inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="new status" aria-label="status" />
      <button type="submit">Update</button>
    </form>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
