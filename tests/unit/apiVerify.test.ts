import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// The handler talks to Supabase over PostgREST, so a local stub is enough to cover the
// public paths end to end: the rate limiter, the verify_member rpc, the fallback for a
// database that has not run the migration yet, and the username check.

type Reply = { status: number; body: unknown };
let rpcReplies: Record<string, Reply> = {};
let usersReply: Reply = { status: 200, body: [] };
let server: http.Server;
let handle: (req: MockRequest, res: MockResponse) => Promise<void>;

type MockRequest = Record<string, unknown>;
type MockResponse = {
  statusCode: number;
  headersSent: boolean;
  writableEnded: boolean;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    await readBody(req);

    if (url.pathname.startsWith('/auth/v1/')) return json(401, { message: 'invalid token' });
    const rpc = url.pathname.replace('/rest/v1/rpc/', '');
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const reply = rpcReplies[rpc] ?? { status: 404, body: { message: `no function ${rpc}` } };
      return json(reply.status, reply.body);
    }
    if (url.pathname === '/rest/v1/users') return json(usersReply.status, usersReply.body);
    if (url.pathname === '/rest/v1/volunteer_hours') return json(404, { message: 'no table' });
    return json(404, { message: 'not found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  // These cases are about the lookup itself, so the card feature has to be switched on for them.
  process.env.CARDS_ENABLED = 'true';
  handle = (await import('../../api/[...path].ts')).default as typeof handle;
}, 20_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  rpcReplies = {
    rate_limit_hit: { status: 200, body: [{ ok: true, resets: new Date(Date.now() + 60_000).toISOString() }] },
    verify_member: { status: 200, body: [] },
    discord_username_taken: { status: 200, body: false },
  };
  usersReply = { status: 200, body: [] };
});

const memberCard = {
  uid: '11111111-1111-4111-8111-111111111111',
  member_id: 'BGPH-2026-001',
  full_name: 'Juan Dela Cruz',
  display_name: null,
  show_full_name: false,
  specialization: 'Engineering',
  secondary_specialization: null,
  role: 'Member',
  status: 'Approved',
  year_joined: 2026,
  discord_username: 'juandc',
  is_admin: false,
};

let ipCounter = 0;

async function callApi(method: string, path: string) {
  const out = { status: 0, headers: {} as Record<string, string>, body: '' };
  const res: MockResponse = {
    headersSent: false,
    writableEnded: false,
    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = String(v); },
    end: (b?: string) => { out.body = b ?? ''; res.writableEnded = true; },
    get statusCode() { return out.status; },
    set statusCode(v: number) { out.status = v; },
  };
  const url = new URL(path, 'http://localhost');
  ipCounter += 1;
  await handle(
    {
      method,
      url: path,
      headers: { host: 'localhost', 'x-forwarded-for': `203.0.113.${ipCounter}` },
      query: Object.fromEntries(url.searchParams),
      body: {},
      socket: {},
    },
    res,
  );
  return { status: out.status, headers: out.headers, json: out.body ? JSON.parse(out.body) : null };
}

describe('GET /api/v1/verify', () => {
  it('returns the redacted card through the rpc', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(200);
    expect(res.json.memberId).toBe('BGPH-2026-001');
    expect(res.json.fullName).toBe('Juan D**** C****');
    expect(res.json.nameRedacted).toBe(true);
    expect(res.json.discordUsername).toBeUndefined();
    expect(res.json.confirmedHours).toBe(0);
  });

  it('rejects filters smuggled into the id', async () => {
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001,email.eq.x');
    expect(res.status).toBe(404);
  });

  it('does not answer uid lookups for anonymous callers', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    const res = await callApi('GET', `/api/v1/verify?id=${memberCard.uid}`);
    expect(res.status).toBe(404);
  });

  it('falls back to the direct read while the migration is pending', async () => {
    rpcReplies.verify_member = { status: 404, body: { message: 'Could not find the function' } };
    usersReply = { status: 200, body: [memberCard] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(200);
    expect(res.json.memberId).toBe('BGPH-2026-001');
  });

  it('returns 429 with Retry-After when the limiter refuses', async () => {
    rpcReplies.rate_limit_hit = { status: 200, body: [{ ok: false, resets: new Date(Date.now() + 42_000).toISOString() }] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('stays up when the rate limit function is missing', async () => {
    rpcReplies.rate_limit_hit = { status: 404, body: { message: 'Could not find the function' } };
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/discord-username-taken', () => {
  it('answers from the security definer function', async () => {
    rpcReplies.discord_username_taken = { status: 200, body: true };
    const res = await callApi('GET', '/api/v1/discord-username-taken?username=juandc');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ taken: true });
  });

  it('falls back to the direct read when the function is missing', async () => {
    rpcReplies.discord_username_taken = { status: 404, body: { message: 'missing' } };
    usersReply = { status: 200, body: [{ uid: '11111111-1111-4111-8111-111111111111' }] };
    const res = await callApi('GET', '/api/v1/discord-username-taken?username=juandc');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ taken: true });
  });
});

describe('GET /api/v1/verify with cards switched off', () => {
  // Hiding the buttons in the client is not switching a feature off: the endpoint has to refuse,
  // or anyone holding an old QR code or a saved URL still gets a card back.
  it('refuses the lookup instead of answering it', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    process.env.CARDS_ENABLED = 'false';
    try {
      const r = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
      expect(r.status).toBe(503);
      // Not a word of the card comes back, redacted or otherwise.
      expect(JSON.stringify(r.json)).not.toContain('Dela Cruz');
      expect(JSON.stringify(r.json)).not.toContain('BGPH-2026-001');
    } finally {
      process.env.CARDS_ENABLED = 'true';
    }
  });

  // Off is the safe state: an unset or unrecognised value must never open the feature, which is
  // what makes forgetting the variable in a new environment harmless.
  it('stays off for anything that is not "true"', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    for (const value of ['', 'yes', '1', 'on', 'false', undefined]) {
      if (value === undefined) delete process.env.CARDS_ENABLED;
      else process.env.CARDS_ENABLED = value;
      // eslint-disable-next-line no-await-in-loop
      const r = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
      expect(r.status, `CARDS_ENABLED=${String(value)}`).toBe(503);
    }
    process.env.CARDS_ENABLED = 'true';
  });

  it('is forgiving about how "true" was typed', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    for (const value of ['true', 'TRUE', ' True ']) {
      process.env.CARDS_ENABLED = value;
      // eslint-disable-next-line no-await-in-loop
      const r = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
      expect(r.status, `CARDS_ENABLED=${value}`).toBe(200);
    }
    process.env.CARDS_ENABLED = 'true';
  });
});
