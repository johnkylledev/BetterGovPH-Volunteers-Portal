import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// The API handler talks to Supabase over PostgREST, so a local stub is enough to
// exercise the public paths end to end: rate limiting, the verify_member rpc and
// the pre-migration fallback.

type RpcReply = { status: number; body: unknown };
let rpcReplies: Record<string, RpcReply> = {};
let usersReply: RpcReply = { status: 200, body: [] };
let server: http.Server;
let baseUrl = '';
type MockRequest = Record<string, unknown>;

type MockResponse = {
  statusCode: number;
  headersSent: boolean;
  writableEnded: boolean;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

let handle: (req: MockRequest, res: MockResponse) => Promise<void>;

const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status: number, body: unknown, extra: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
      res.end(JSON.stringify(body));
    };
    await readBody(req);

    if (url.pathname.startsWith('/auth/v1/')) return json(401, { message: 'invalid token' });
    if (url.pathname === '/rest/v1/rpc/rate_limit_hit') return json(rpcReplies.rate_limit_hit.status, rpcReplies.rate_limit_hit.body);
    if (url.pathname === '/rest/v1/rpc/verify_member') return json(rpcReplies.verify_member.status, rpcReplies.verify_member.body);
    if (url.pathname === '/rest/v1/rpc/discord_username_taken') return json(rpcReplies.discord_username_taken.status, rpcReplies.discord_username_taken.body);
    if (url.pathname === '/rest/v1/users') return json(usersReply.status, usersReply.body);
    return json(404, { message: 'not found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.SUPABASE_URL = baseUrl;
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  handle = (await import('../../api/[...path].ts')).default as typeof handle;
}, 20_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  rpcReplies = {
    rate_limit_hit: { status: 200, body: [{ allowed: true, remaining: 29, retry_after: 60 }] },
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
  await handle(
    {
      method,
      url: path,
      headers: { host: 'localhost', 'x-forwarded-for': '203.0.113.7' },
      query: Object.fromEntries(url.searchParams),
      body: {},
      socket: {},
    },
    res,
  );
  return { status: out.status, headers: out.headers, json: out.body ? JSON.parse(out.body) : null };
}

describe('GET /api/v1/verify', () => {
  it('returns the redacted card through the anon rpc', async () => {
    rpcReplies.verify_member = { status: 200, body: [memberCard] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(200);
    expect(res.json.memberId).toBe('BGPH-2026-001');
    expect(res.json.fullName).toBe('Juan D**** C****');
    expect(res.json.nameRedacted).toBe(true);
    expect(res.json.discordUsername).toBeUndefined();
  });

  it('rejects filters smuggled into the id without touching the database', async () => {
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001,email.eq.x');
    expect(res.status).toBe(404);
    expect(rpcReplies.verify_member.status).toBe(200);
  });

  it('falls back to the direct read while the migration is pending', async () => {
    rpcReplies.verify_member = { status: 404, body: { message: 'Could not find the function' } };
    usersReply = { status: 200, body: [memberCard] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(200);
    expect(res.json.memberId).toBe('BGPH-2026-001');
  });

  it('rate limits with 429 + Retry-After', async () => {
    rpcReplies.rate_limit_hit = { status: 200, body: [{ allowed: false, remaining: 0, retry_after: 42 }] };
    const res = await callApi('GET', '/api/v1/verify?id=BGPH-2026-001');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('42');
  });

  it('stays up when the rate limit table is missing', async () => {
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
