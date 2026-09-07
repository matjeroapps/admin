import { describe, it, expect } from 'vitest';
import { sellerNavigation, supplierNavigation, adminNavigation, navigationRegistry } from '../src/index.js';

describe('MatjerHub Navigation Architecture', () => {
  it('contains valid Seller navigation routes', () => {
    const paths = sellerNavigation.map((n) => n.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/stores');
    expect(paths).toContain('/products');
    expect(paths).toContain('/inventory');
    expect(paths).toContain('/orders');
    expect(paths).toContain('/themes');
    expect(paths).toContain('/finance');
  });

  it('contains valid Supplier navigation routes', () => {
    const paths = supplierNavigation.map((n) => n.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/catalog');
    expect(paths).toContain('/offers');
    expect(paths).toContain('/inventory');
    expect(paths).toContain('/fulfillment');
  });

  it('contains valid Admin navigation routes', () => {
    const paths = adminNavigation.map((n) => n.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/tenants');
    expect(paths).toContain('/users');
    expect(paths).toContain('/roles');
    expect(paths).toContain('/configuration');
  });

  it('provides complete navigationRegistry', () => {
    expect(navigationRegistry.seller).toEqual(sellerNavigation);
    expect(navigationRegistry.supplier).toEqual(supplierNavigation);
    expect(navigationRegistry.admin).toEqual(adminNavigation);
  });
});
