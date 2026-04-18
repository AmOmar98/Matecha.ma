import { describe, it, expect } from 'vitest';
import { normalizeRow, computeCategorySavings, mapCategory } from './build-savings-summary.mjs';

describe('mapCategory', () => {
  it('maps known labels', () => {
    expect(mapCategory('Animalerie')).toBe('animalerie');
    expect(mapCategory('Epicerie')).toBe('epicerie');
    expect(mapCategory('Épicerie')).toBe('epicerie');
    expect(mapCategory('Produits laitiers, œufs')).toBe('laitiers');
    expect(mapCategory('Boissons')).toBe('boissons');
  });
  it('returns null for unknown', () => {
    expect(mapCategory('Baby')).toBeNull();
    expect(mapCategory('FMCG')).toBeNull();
    expect(mapCategory('')).toBeNull();
  });
});

describe('normalizeRow', () => {
  it('returns null when category is unknown', () => {
    expect(normalizeRow({ category: 'Baby', canonical_name: 'X', brand: 'Y', effective_price: '10', is_comparable: 'TRUE' }, 'marjane')).toBeNull();
  });
  it('marks needs_review when review_flag is non-empty', () => {
    const r = normalizeRow({ category: 'Epicerie', canonical_name: 'X', brand: 'Y',
      effective_price: '10', is_comparable: 'TRUE', review_flag: 'fallback_review' }, 'marjane');
    expect(r.needs_review).toBe(true);
  });
  it('marks needs_review when is_comparable is FALSE', () => {
    const r = normalizeRow({ category: 'Epicerie', canonical_name: 'X', brand: 'Y',
      effective_price: '10', is_comparable: 'FALSE', review_flag: '' }, 'marjane');
    expect(r.needs_review).toBe(true);
  });
  it('returns clean entry when comparable and no review_flag', () => {
    const r = normalizeRow({ category: 'Epicerie', canonical_name: 'Barilla Spaghetti 500g',
      brand: 'Barilla', effective_price: '30', comparable_price_value: '60',
      comparable_price_unit: 'MAD/kg', is_comparable: 'TRUE', review_flag: '' }, 'marjane');
    expect(r).toEqual({
      product_name: 'Barilla Spaghetti 500g', brand: 'Barilla', category: 'epicerie',
      supplier: 'marjane', price_mad: 30, unit_price_mad: 60, unit_price_basis: 'kg',
      needs_review: false,
    });
  });
});

describe('computeCategorySavings', () => {
  it('computes p25/p75 spread per category', () => {
    const items = [
      { category: 'epicerie', brand: 'A', product_name: 'X', supplier: 'marjane', unit_price_mad: 30, needs_review: false },
      { category: 'epicerie', brand: 'A', product_name: 'X', supplier: 'carrefour', unit_price_mad: 22, needs_review: false },
      { category: 'epicerie', brand: 'B', product_name: 'Y', supplier: 'marjane', unit_price_mad: 40, needs_review: false },
      { category: 'epicerie', brand: 'B', product_name: 'Y', supplier: 'carrefour', unit_price_mad: 28, needs_review: false },
    ];
    const r = computeCategorySavings(items);
    const epi = r.find(c => c.slug === 'epicerie');
    expect(epi).toBeDefined();
    expect(epi.sample_comparable_products).toBe(2);
    expect(epi.savings_min_pct).toBeGreaterThan(0);
    expect(epi.savings_max_pct).toBeGreaterThanOrEqual(epi.savings_min_pct);
  });
  it('skips items needing review', () => {
    const items = [
      { category: 'epicerie', brand: 'A', product_name: 'X', supplier: 'm', unit_price_mad: 10, needs_review: true },
      { category: 'epicerie', brand: 'A', product_name: 'X', supplier: 'c', unit_price_mad: 20, needs_review: false },
    ];
    expect(computeCategorySavings(items)).toEqual([]);
  });
  it('skips groups with only one supplier', () => {
    const items = [
      { category: 'epicerie', brand: 'A', product_name: 'X', supplier: 'm', unit_price_mad: 10, needs_review: false },
    ];
    expect(computeCategorySavings(items)).toEqual([]);
  });
});
