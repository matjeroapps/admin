import React from 'react';
import { createRoot } from 'react-dom/client';
import { createApiClient } from './lib/api';
import { directionFor, messages, type Locale } from './i18n/locales';
import { createOidcAuthClient, type AuthClient, type AuthState } from './auth/oidc';
import { DomainModerationPanel } from './components/DomainModerationPanel';
import '@matjerhub/ui/styles.css';
import {
  DashboardLayout,
  adminNavigation,
  AnonymousState,
  UnauthorizedState,
  LoadingState,
  ErrorState,
  Card,
  CardTitle,
  Badge,
  Button,
} from '@matjerhub/ui';
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
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname || '/dashboard');

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

  // 1. Loading
  if (authState.isLoading || callbackProcessing) {
    return (
      <div data-testid="auth-loading" style={{ padding: '24px' }}>
        <LoadingState type="fullPage" title={copy.status || 'Authenticating...'} />
      </div>
    );
  }

  // 2. Config Error
  if (authState.error && authState.error.includes('Authentication configuration missing')) {
    return (
      <div data-testid="config-error" style={{ padding: '24px' }}>
        <ErrorState title="Authentication Configuration Error" message={authState.error} />
      </div>
    );
  }

  // 3. Auth Error
  if (callbackError || (authState.error && !authState.isAuthenticated)) {
    return (
      <div data-testid="auth-error" style={{ padding: '24px' }}>
        <ErrorState title="Authentication Error" message={callbackError || authState.error || ''} />
        <Button onClick={() => void authClient.login()} style={{ marginTop: '12px' }}>
          Try Again
        </Button>
      </div>
    );
  }

  // 4. Forbidden
  if (isForbidden) {
    return (
      <div data-testid="forbidden-state" style={{ padding: '24px' }}>
        <UnauthorizedState
          title="Access Denied (403)"
          message="Platform Administrator authorization (RolePlatformAdmin) is required to access the Admin Console."
          onSignIn={() => void authClient.login()}
        />
      </div>
    );
  }

  // 5. Unauthenticated
  if (!authState.isAuthenticated) {
    return (
      <div data-testid="unauthenticated-state">
        <AnonymousState appName="Admin Platform" onSignIn={() => void authClient.login()} />
        <div style={{ textAlign: 'center', marginTop: '-20px', paddingBottom: '20px' }}>
          <Button onClick={() => void authClient.login()}>Sign in</Button>
        </div>
      </div>
    );
  }

  // 6. Dashboard
  return (
    <DashboardLayout
      appTitle="MatjerHub Admin"
      navItems={adminNavigation}
      currentPath={currentPath}
      onNavigate={(path) => {
        setCurrentPath(path);
        window.history.pushState({}, '', path);
      }}
      workspaces={[{ id: 'admin-main', name: 'Platform Admin', type: 'admin' }]}
      user={{
        name: authState.user?.preferred_username || bootstrap?.principal?.preferred_username || 'Admin User',
        email: authState.user?.email || 'admin@matjerhub.com',
        role: 'Platform Admin',
      }}
      onSignOut={() => void authClient.logout()}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} data-testid="authenticated-dashboard">
        {error ? <ErrorState message={error} /> : null}
        {loading ? <LoadingState title="Loading dashboard..." /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {Object.entries(counts).map(([key, value]) => (
            <Card key={key} variant="glass">
              <span style={{ fontSize: '12px', color: 'var(--color-muted-foreground)', textTransform: 'uppercase' }}>
                {key}
              </span>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{value}</div>
            </Card>
          ))}
        </div>

        <DomainModerationPanel api={api} stores={stores} sellers={sellers} locale={locale} />
      </div>
    </DashboardLayout>
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
