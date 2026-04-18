/**
 * build-catalog-search.mjs
 * Reads classified supplier CSV/XLSX files and writes catalog-search.json
 * for the interactive comparator page.
 *
 * Groups products by comparison_group, keeps only entries with >=2 distinct
 * suppliers, and emits best/worst price + savings_pct for each group.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { parse } from 'csv-parse/sync';
import XLSXModule from 'xlsx';
// xlsx ships as CJS; in ESM the real API lives on .default
const XLSX = XLSXModule.default ?? XLSXModule;

import { normalizeRow } from './build-savings-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPLIERS_DB = 'C:/Users/omara/Desktop/Matecha/SuppliersDB';

const OUTPUT_PATH = join(
  __dirname,
  '../public/assets/data/catalog-search.json'
);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Slugify a string: lowercase, strip diacritics, replace non-alphanumeric with dashes.
 */
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Pick the most descriptive (longest) non-empty name from an array of names.
 */
export function pickName(names) {
  return names
    .filter((n) => n != null && String(n).trim() !== '')
    .map((n) => String(n).trim())
    .sort((a, b) => b.length - a.length)[0] ?? '';
}

/**
 * Build a URL-safe product ID from category + brand + name.
 * Appends a short hash suffix if needed for uniqueness (handled at call site).
 */
export function makeId(category, brand, name) {
  const parts = [slugify(category), brand ? slugify(brand) : null, slugify(name)]
    .filter(Boolean)
    .join('-');
  // Limit to 80 chars
  return parts.slice(0, 80).replace(/-$/, '');
}

/**
 * Generate a short 6-char hash suffix from a string (for dedup).
 */
function hashSuffix(s) {
  return createHash('md5').update(s).digest('hex').slice(0, 6);
}

// ---------------------------------------------------------------------------
// Core catalog builder (pure function — accepts pre-normalised rows)
// ---------------------------------------------------------------------------

/**
 * Build the catalog output from an array of flat item rows.
 *
 * Each row must have:
 *   comparison_group, canonical_name, brand, category,
 *   supplier, price_mad, needs_review, url
 *
 * @param {Array} items
 * @returns {{ products: Array }}
 */
export function buildCatalog(items) {
  // 1. Filter: valid comparison group, no review, positive price
  const valid = items.filter(
    (i) =>
      i.comparison_group &&
      String(i.comparison_group).trim() !== '' &&
      i.needs_review === false &&
      i.price_mad > 0
  );

  // 2. Group by comparison_group
  const groups = new Map();
  for (const item of valid) {
    const key = String(item.comparison_group).trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const products = [];
  const seenIds = new Map(); // id → count for uniqueness

  for (const [groupKey, entries] of groups) {
    // 3. Dedupe by supplier: keep the lowest price row per supplier
    const bySupplier = new Map();
    for (const entry of entries) {
      const s = entry.supplier;
      if (!bySupplier.has(s) || entry.price_mad < bySupplier.get(s).price_mad) {
        bySupplier.set(s, entry);
      }
    }

    // 4. Skip groups with < 2 distinct suppliers
    if (bySupplier.size < 2) continue;

    // 5. Sort suppliers ascending by price
    const sortedSuppliers = [...bySupplier.values()].sort(
      (a, b) => a.price_mad - b.price_mad
    );

    const best = sortedSuppliers[0];
    const worst = sortedSuppliers[sortedSuppliers.length - 1];

    const rawSavings = Math.round(
      ((worst.price_mad - best.price_mad) / worst.price_mad) * 100
    );
    // Clamp to [0, 99] — values above 99 indicate data issues
    const savings_pct = Math.min(99, Math.max(0, rawSavings));

    // 6. name = longest canonical_name in the group; brand = first non-empty; category = first
    const name = pickName(entries.map((i) => i.canonical_name));
    const brand =
      entries.map((i) => String(i.brand ?? '').trim()).find((b) => b !== '') ?? null;
    const category = entries[0].category;

    // 7. Build ID and ensure uniqueness
    let id = makeId(category, brand, name);
    if (!id) id = slugify(groupKey);
    id = id.slice(0, 80);

    if (seenIds.has(id)) {
      // Append short hash of the comparison_group to disambiguate
      id = `${id.slice(0, 73)}-${hashSuffix(groupKey)}`;
    }
    seenIds.set(id, (seenIds.get(id) ?? 0) + 1);

    products.push({
      id,
      name,
      brand: brand || null,
      category,
      suppliers: sortedSuppliers.map((e) => ({
        supplier: e.supplier,
        price_mad: e.price_mad,
        url: e.url ?? '',
      })),
      best_supplier: best.supplier,
      best_price_mad: best.price_mad,
      worst_price_mad: worst.price_mad,
      savings_pct,
    });
  }

  // Sort products by savings_pct descending (most savings first)
  products.sort((a, b) => b.savings_pct - a.savings_pct);

  return { products };
}

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

function readCsv(filePath) {
  const content = readFileSync(filePath);
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relaxColumnCount: true,
  });
}

function readXlsx(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// ---------------------------------------------------------------------------
// Loader: reads all three supplier files and normalises them
// Reuses normalizeRow from build-savings-summary.mjs for parity.
// ---------------------------------------------------------------------------

export async function loadAllSuppliers() {
  const carrefourRows = readCsv(
    `${SUPPLIERS_DB}/carrefour_glovo_products_classified_deduplicated.csv`
  );
  const mymarketRows = readCsv(
    `${SUPPLIERS_DB}/mymarket_products_classified_v2.csv`
  );
  const marjaneRows = readXlsx(
    `${SUPPLIERS_DB}/marjane_products_classified.xlsx`
  );

  const sourceCounts = {
    carrefour: carrefourRows.length,
    mymarket: mymarketRows.length,
    marjane: marjaneRows.length,
  };

  const normalise = (rows, supplier) =>
    rows
      .map((r) => {
        const item = normalizeRow(r, supplier);
        if (!item) return null;
        return {
          ...item,
          canonical_name: String(r.canonical_name ?? '').trim(),
          comparison_group: String(r.comparison_group ?? '').trim(),
          url: String(r.source_url ?? '').trim(),
          // price_mad is already set by normalizeRow as effective_price
        };
      })
      .filter(Boolean);

  const allItems = [
    ...normalise(carrefourRows, 'carrefour'),
    ...normalise(mymarketRows, 'mymarket'),
    ...normalise(marjaneRows, 'marjane'),
  ];

  return { items: allItems, sourceCounts };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main() {
  console.log('Reading supplier files…');

  const { items, sourceCounts } = await loadAllSuppliers();

  console.log(
    `Raw counts — carrefour: ${sourceCounts.carrefour}, mymarket: ${sourceCounts.mymarket}, marjane: ${sourceCounts.marjane}`
  );
  console.log(`Normalised items: ${items.length}`);

  const out = buildCatalog(items);
  out.generated_at = new Date().toISOString();
  out.source_counts = sourceCounts;

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`Wrote ${out.products.length} comparable products → ${OUTPUT_PATH}`);
}

// Run when executed directly
const __filename = fileURLToPath(import.meta.url);
const _argv1 = process.argv[1] ?? '';
const _normalise = (p) => p.replace(/\\/g, '/').toLowerCase();
if (_normalise(__filename) === _normalise(_argv1)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
