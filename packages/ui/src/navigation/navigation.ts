import { NavItem } from '../shell/Sidebar.js';

export const sellerNavigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'stores', label: 'Stores', icon: '🏪', path: '/stores' },
  { id: 'products', label: 'Products', icon: '📦', path: '/products' },
  { id: 'inventory', label: 'Inventory', icon: '🏭', path: '/inventory' },
  { id: 'orders', label: 'Orders', icon: '🛒', path: '/orders', badge: 'New' },
  { id: 'themes', label: 'Themes', icon: '🎨', path: '/themes' },
  { id: 'finance', label: 'Finance', icon: '💳', path: '/finance' },
];

export const supplierNavigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'catalog', label: 'Catalog', icon: '📚', path: '/catalog' },
  { id: 'offers', label: 'Offers', icon: '🏷️', path: '/offers' },
  { id: 'inventory', label: 'Inventory', icon: '🏭', path: '/inventory' },
  { id: 'fulfillment', label: 'Fulfillment', icon: '🚚', path: '/fulfillment' },
];

export const adminNavigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'tenants', label: 'Tenants', icon: '🏢', path: '/tenants' },
  { id: 'users', label: 'Users', icon: '👥', path: '/users' },
  { id: 'roles', label: 'Roles', icon: '🛡️', path: '/roles' },
  { id: 'configuration', label: 'Configuration', icon: '⚙️', path: '/configuration' },
];

export const navigationRegistry = {
  seller: sellerNavigation,
  supplier: supplierNavigation,
  admin: adminNavigation,
};
