import { vi, describe, it, expect, beforeEach } from 'vitest';

globalThis.__priceReportCapture__ = { lastInsert: null, shouldError: false };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: async (row) => {
        globalThis.__priceReportCapture__.lastInsert = row;
        if (globalThis.__priceReportCapture__.shouldError) return { error: { message: 'boom' } };
        return { error: null };
      },
    }),
  }),
}));

const { default: handler } = await import('./price-report.js');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function mockReq(method, body) {
  return { method, body: body ?? {} };
}

beforeEach(() => {
  globalThis.__priceReportCapture__.lastInsert = null;
  globalThis.__priceReportCapture__.shouldError = false;
  process.env.SUPABASE_URL = 'x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
});

describe('POST /api/price-report', () => {
  it('rejects missing product_id', async () => {
    const req = mockReq('POST', { supplier: 'marjane' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'missing_fields' });
  });

  it('rejects missing product_name', async () => {
    const req = mockReq('POST', { product_id: '123', supplier: 'marjane' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'missing_fields' });
  });

  it('rejects missing supplier', async () => {
    const req = mockReq('POST', { product_id: '123', product_name: 'Widget' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'missing_fields' });
  });

  it('accepts a valid report', async () => {
    const req = mockReq('POST', {
      product_id: '123',
      product_name: 'Widget',
      supplier: 'marjane',
      reported_price_mad: 100,
      correct_price_mad: 120,
      reporter_wa: '+212612345678',
      note: 'Test note',
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 405 on GET', async () => {
    const req = mockReq('GET', null);
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'method_not_allowed' });
  });

  it('truncates note to 500 chars', async () => {
    const req = mockReq('POST', {
      product_id: '123',
      product_name: 'Widget',
      supplier: 'marjane',
      note: 'x'.repeat(800),
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(globalThis.__priceReportCapture__.lastInsert.note.length).toBe(500);
  });

  it('returns 500 when supabase errors', async () => {
    globalThis.__priceReportCapture__.shouldError = true;
    const req = mockReq('POST', {
      product_id: '123',
      product_name: 'Widget',
      supplier: 'marjane',
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error' });
  });
});
