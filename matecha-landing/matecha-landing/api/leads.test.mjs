import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// Initialise a single shared-state object on globalThis BEFORE the mock factory
// runs (vi.mock is hoisted but this initialiser line is not, so we seed it here
// and the factory — and every test — mutates the same object in-place).
globalThis.__leadsTestState__ = { simulateConflict: false };

vi.mock('@supabase/supabase-js', () => {
  const buildChain = () => {
    const chain = {
      from: () => chain,
      upsert: (_row) => {
        // Read the flag directly from globalThis at call time (not a captured copy)
        if (globalThis.__leadsTestState__?.simulateConflict) {
          return {
            select: () => ({
              single: () => Promise.resolve({
                data: null,
                error: { code: '23505', message: 'duplicate key' },
              }),
            }),
          };
        }
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: { ..._row },
              error: null,
            }),
          }),
        };
      },
    };
    return chain;
  };

  return {
    createClient: () => buildChain(),
  };
});

// ── Helper ───────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader() { return this; },
  };
  return res;
}

function mockReq(method, body) {
  return { method, body: body ?? {} };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/leads', () => {
  beforeEach(async () => {
    globalThis.__leadsTestState__.simulateConflict = false;
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
    process.env.CANAL_WHATSAPP_URL = 'https://whatsapp.com/channel/abc';
    process.env.LAUNCH_OFFER_CODE_PREFIX = 'MATECHA';
  });

  it('rejects missing CNDP consent', async () => {
    const { default: handler } = await import('./leads.js');
    const req = mockReq('POST', {
      whatsapp_number: '+212612345678',
      consent_cndp: false,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'missing_consent' });
  });

  it('rejects invalid Moroccan phone', async () => {
    const { default: handler } = await import('./leads.js');
    const req = mockReq('POST', {
      whatsapp_number: '0675742868',
      consent_cndp: true,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_phone' });
  });

  it('rejects invalid email format', async () => {
    const { default: handler } = await import('./leads.js');
    const req = mockReq('POST', {
      whatsapp_number: '+212612345678',
      consent_cndp: true,
      email: 'not-an-email',
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_email' });
  });

  it('creates lead and returns offer_code + canal_url', async () => {
    const { default: handler } = await import('./leads.js');
    const req = mockReq('POST', {
      whatsapp_number: '+212612345678',
      consent_cndp: true,
      canal_optin: true,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.offer_code).toMatch(/^MATECHA-[A-Z0-9]{6}$/);
    expect(res.body.canal_url).toBe('https://whatsapp.com/channel/abc');
  });

  it('returns 409 when supabase raises unique violation (code 23505)', async () => {
    globalThis.__leadsTestState__.simulateConflict = true;
    const { default: handler } = await import('./leads.js');
    const req = mockReq('POST', {
      whatsapp_number: '+212612345678',
      consent_cndp: true,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'already_registered' });
  });

  it('returns 405 on GET', async () => {
    const { default: handler } = await import('./leads.js');
    const req = mockReq('GET', null);
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
