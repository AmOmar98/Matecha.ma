/**
 * build-savings-summary.mjs
 * Reads classified supplier CSV/XLSX files and writes savings-summary.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import XLSXModule from 'xlsx';
// xlsx ships as CJS; in ESM the real API lives on .default
const XLSX = XLSXModule.default ?? XLSXModule;

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPLIERS_DB = 'C:/Users/omara/Desktop/Matecha/SuppliersDB';

const OUTPUT_PATH = join(
  __dirname,
  '../public/assets/data/savings-summary.json'
);

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

/**
 * Map a raw category string (as it appears in the CSV/XLSX) to a slug.
 * Returns null if the category should be skipped.
 */
export function mapCategory(raw) {
  if (!raw) return null;
  const v = raw.trim();

  // Exact / canonical spec labels first
  if (v === 'Animalerie') return 'animalerie';
  if (v === 'Epicerie' || v === 'Épicerie') return 'epicerie';
  if (v === 'Produits laitiers, œufs') return 'laitiers';
  if (v === 'Boissons' || v === 'Beverages') return 'boissons';
  if (v === 'Fruits & Légumes' || v === 'Produce') return 'fruits_legumes';

  // Carrefour-specific labels
  if (v === 'Eaux Boissons') return 'boissons';
  if (v === 'Produits Laitiers Oeufs') return 'laitiers';
  if (v === 'Fruits Et Legumes') return 'fruits_legumes';

  // Marjane-specific labels (may have encoding artifacts — match accent-free forms too)
  if (/^animaux$/i.test(v)) return 'animalerie';
  if (/^eaux[, ]*boissons$/i.test(v)) return 'boissons';
  if (/^produits laitiers oeufs$/i.test(v)) return 'laitiers';
  if (/^produits laitiers[, ]*[oO]eufs$/i.test(v)) return 'laitiers';
  if (/^fruits?[^a-z]*l.gumes?$/i.test(v)) return 'fruits_legumes';
  if (/^épicerie fine$/i.test(v)) return 'epicerie';

  // Anything else → skip
  return null;
}

const CAT_LABELS = {
  animalerie: 'Animalerie',
  epicerie: 'Épicerie',
  laitiers: 'Produits laitiers',
  boissons: 'Boissons',
  fruits_legumes: 'Fruits & Légumes',
};

// ---------------------------------------------------------------------------
// Row normalisation
// ---------------------------------------------------------------------------

/**
 * Convert a raw row object to a normalised entry, or null if it should be skipped.
 * @param {Record<string,string|number>} row
 * @param {string} supplier  'carrefour' | 'marjane' | 'mymarket'
 */
export function normalizeRow(row, supplier) {
  const category = mapCategory(String(row.category ?? ''));
  if (!category) return null;

  const isComparable =
    String(row.is_comparable ?? '').toUpperCase() === 'TRUE' ||
    String(row.is_comparable ?? '') === 'true';
  // review_flag may be a boolean false (from XLSX) or an empty string — both mean "no flag"
  const rawFlag = row.review_flag;
  const reviewFlag =
    rawFlag === false || rawFlag === 0 || rawFlag == null
      ? ''
      : String(rawFlag).trim();
  const needs_review = !isComparable || reviewFlag !== '';

  const price_mad = parseFloat(row.effective_price) || 0;
  const unit_price_mad =
    row.comparable_price_value !== undefined &&
    row.comparable_price_value !== null &&
    String(row.comparable_price_value).trim() !== ''
      ? parseFloat(row.comparable_price_value) || null
      : null;
  // Normalise unit basis: strip "MAD/" prefix so "MAD/kg"→"kg", "MAD/L"→"l", etc.
  const rawBasis = row.comparable_price_unit
    ? String(row.comparable_price_unit).trim()
    : '';
  const unit_price_basis = rawBasis
    ? rawBasis.replace(/^MAD\//i, '').toLowerCase() || null
    : null;

  return {
    product_name: String(row.canonical_name ?? '').trim(),
    brand: String(row.brand ?? '').trim(),
    category,
    supplier,
    price_mad,
    unit_price_mad,
    unit_price_basis,
    needs_review,
  };
}

// ---------------------------------------------------------------------------
// Savings computation
// ---------------------------------------------------------------------------

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Given a flat array of normalised items, compute per-category savings stats.
 */
// Max plausible unit price (MAD/kg or MAD/l). Values above this are data errors.
const MAX_UNIT_PRICE = 5000;

export function computeCategorySavings(items) {
  // 1. Filter: no review, positive unit price, below sanity cap
  const valid = items.filter(
    (i) => i.needs_review === false && i.unit_price_mad > 0 && i.unit_price_mad <= MAX_UNIT_PRICE
  );

  // 2. Group by (category, brand, product_name)
  const groups = new Map();
  for (const item of valid) {
    const key = `${item.category}|||${item.brand}|||${item.product_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  // 3. Per group: skip if <2 distinct suppliers or mixed unit bases; compute spread pct
  // Collect spreads per category
  const catSpreads = new Map(); // slug → number[]

  for (const [key, entries] of groups) {
    const supplierSet = new Set(entries.map((e) => e.supplier));
    if (supplierSet.size < 2) continue;

    // Skip groups where unit bases are inconsistent (e.g. kg vs unit)
    const bases = new Set(entries.map((e) => e.unit_price_basis).filter(Boolean));
    if (bases.size > 1) continue;

    // Use the median unit price per supplier, then compare across suppliers.
    // This avoids one supplier's wide product range skewing the spread.
    const bySupplier = new Map();
    for (const e of entries) {
      if (!bySupplier.has(e.supplier)) bySupplier.set(e.supplier, []);
      bySupplier.get(e.supplier).push(e.unit_price_mad);
    }
    const supplierMedians = [];
    for (const prices of bySupplier.values()) {
      const sorted = [...prices].sort((a, b) => a - b);
      supplierMedians.push(sorted[Math.floor(sorted.length / 2)]);
    }

    const min = Math.min(...supplierMedians);
    const max = Math.max(...supplierMedians);
    const spreadPct = ((max - min) / min) * 100;

    const category = entries[0].category;
    if (!catSpreads.has(category)) catSpreads.set(category, []);
    catSpreads.get(category).push(spreadPct);
  }

  // 4. Per category output
  const result = [];
  for (const [slug, spreads] of catSpreads) {
    const sorted = [...spreads].sort((a, b) => a - b);
    const p25 = Math.round(percentile(sorted, 25));
    const p75 = Math.round(percentile(sorted, 75));
    result.push({
      slug,
      label: CAT_LABELS[slug] ?? slug,
      savings_min_pct: p25,
      savings_max_pct: p75,
      sample_comparable_products: spreads.length,
    });
  }

  return result;
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
// Main
// ---------------------------------------------------------------------------

export async function main() {
  console.log('Reading supplier files…');

  const carrefourRows = readCsv(
    `${SUPPLIERS_DB}/carrefour_glovo_products_classified_deduplicated.csv`
  );
  const mymarketRows = readCsv(
    `${SUPPLIERS_DB}/mymarket_products_classified_v2.csv`
  );
  const marjaneRows = readXlsx(
    `${SUPPLIERS_DB}/marjane_products_classified.xlsx`
  );

  console.log(
    `Raw counts — carrefour: ${carrefourRows.length}, mymarket: ${mymarketRows.length}, marjane: ${marjaneRows.length}`
  );

  const source_counts = {
    carrefour: carrefourRows.length,
    marjane: marjaneRows.length,
    mymarket: mymarketRows.length,
  };

  // Normalise — and override product_name with comparison_group so that the
  // same product type matches across suppliers (canonical_name is supplier-specific).
  const normaliseWithGroup = (rows, supplier) =>
    rows.map((r) => {
      const item = normalizeRow(r, supplier);
      if (!item) return null;
      const group = String(r.comparison_group ?? '').trim();
      if (group) item.product_name = group;
      return item;
    });

  const allItems = [
    ...normaliseWithGroup(carrefourRows, 'carrefour'),
    ...normaliseWithGroup(mymarketRows, 'mymarket'),
    ...normaliseWithGroup(marjaneRows, 'marjane'),
  ].filter(Boolean);

  console.log(`Normalised items: ${allItems.length}`);

  const categories = computeCategorySavings(allItems);
  console.log(
    `Categories computed: ${categories.map((c) => c.slug).join(', ')}`
  );

  const output = {
    generated_at: new Date().toISOString(),
    source_counts,
    categories,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Written → ${OUTPUT_PATH}`);
}

// Run when executed directly (works on Windows and Unix)
const __filename = fileURLToPath(import.meta.url);
const _argv1 = process.argv[1] ?? '';
const _normalise = (p) => p.replace(/\\/g, '/').toLowerCase();
if (_normalise(__filename) === _normalise(_argv1)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
