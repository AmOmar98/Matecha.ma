import { describe, it, expect } from 'vitest';
import { buildCatalog, pickName, makeId } from './build-catalog-search.mjs';

describe('pickName', () => {
  it('picks the longest non-empty name', () => {
    expect(pickName(['Spaghetti', 'Barilla Spaghetti 500g n°5', 'Spaghetti Barilla'])).toBe('Barilla Spaghetti 500g n°5');
  });
  it('ignores empty strings', () => {
    expect(pickName(['', 'X', null, 'XY'])).toBe('XY');
  });
});

describe('makeId', () => {
  it('slugifies category + brand + name', () => {
    expect(makeId('epicerie', 'Barilla', 'Spaghetti n°5 500g')).toMatch(/^epicerie-barilla-spaghetti-n-?5-500g/);
  });
  it('handles null brand', () => {
    expect(makeId('epicerie', null, 'Lait 1L')).toMatch(/^epicerie-lait-1l/);
  });
});

describe('buildCatalog', () => {
  const fakeRows = [
    { comparison_group: 'g1', canonical_name: 'Barilla Spaghetti 500g', brand: 'Barilla', category: 'epicerie',
      supplier: 'marjane', price_mad: 30, needs_review: false, url: 'm' },
    { comparison_group: 'g1', canonical_name: 'Spaghetti Barilla', brand: 'Barilla', category: 'epicerie',
      supplier: 'carrefour', price_mad: 22, needs_review: false, url: 'c' },
    { comparison_group: 'g2', canonical_name: 'Huile olive 1L', brand: 'Mabrouka', category: 'epicerie',
      supplier: 'marjane', price_mad: 80, needs_review: false, url: 'm2' },
  ];

  it('groups by comparison_group with >=2 suppliers', () => {
    const out = buildCatalog(fakeRows);
    expect(out.products).toHaveLength(1);
    const p = out.products[0];
    expect(p.best_supplier).toBe('carrefour');
    expect(p.best_price_mad).toBe(22);
    expect(p.worst_price_mad).toBe(30);
    expect(p.savings_pct).toBe(27);
    expect(p.suppliers).toHaveLength(2);
    expect(p.name).toBe('Barilla Spaghetti 500g');
  });

  it('skips groups needing review', () => {
    const rows = [
      { comparison_group: 'g', canonical_name: 'X', brand: 'B', category: 'epicerie',
        supplier: 'marjane', price_mad: 10, needs_review: true, url: '' },
      { comparison_group: 'g', canonical_name: 'X', brand: 'B', category: 'epicerie',
        supplier: 'carrefour', price_mad: 12, needs_review: false, url: '' },
    ];
    expect(buildCatalog(rows).products).toEqual([]);
  });

  it('skips groups with one supplier', () => {
    const rows = [fakeRows[2]];
    expect(buildCatalog(rows).products).toEqual([]);
  });

  it('dedupes multiple rows of same supplier (keeps lowest price)', () => {
    const rows = [
      { comparison_group: 'g', canonical_name: 'Lait', brand: 'C', category: 'laitiers',
        supplier: 'marjane', price_mad: 10, needs_review: false, url: 'a' },
      { comparison_group: 'g', canonical_name: 'Lait', brand: 'C', category: 'laitiers',
        supplier: 'marjane', price_mad: 8, needs_review: false, url: 'b' },
      { comparison_group: 'g', canonical_name: 'Lait', brand: 'C', category: 'laitiers',
        supplier: 'carrefour', price_mad: 9, needs_review: false, url: 'c' },
    ];
    const p = buildCatalog(rows).products[0];
    expect(p.best_supplier).toBe('marjane');
    expect(p.best_price_mad).toBe(8);
  });
});
