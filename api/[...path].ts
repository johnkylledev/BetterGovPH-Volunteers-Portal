const API_VERSION = '1.0.0';

let bootFailure: string | null = null;

const sendJson = (res: any, statusCode: number, body: Record<string, unknown>) => {
  try {
    if (!res) return;
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-API-Version', API_VERSION);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    res.end(JSON.stringify(body));
  } catch {
    try {
      if (res && !res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Response write failed' }));
      } else if (res && !res.writableEnded) {
        res.end();
      }
    } catch {
      // no-op
    }
  }
};

const sendError = (res: any, statusCode: number, message: string) =>
  sendJson(res, statusCode, { error: message });

const errorToString = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return String((err as any).message);
  }
  return 'Internal server error';
};

type Handler = (req: any, res: any) => any;
const handlers: Record<string, Handler | null> = {
  '/me': null,
  '/admin': null,
  '/projects': null,
  '/submit-project': null,
  '/my-project-submissions': null,
  '/volunteer-calls': null,
  '/verify': null,
  '/discord': null,
  '/discord-username-taken': null,
  '/contribution-scores': null,
};

// CJS require() executes INLINE — NOT hoisted — so these are fully catchable.
// Vercel's bundler still sees the literal require() strings and bundles the files.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/me');
  handlers['/me'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /me load failed', err);
  if (!bootFailure) bootFailure = '/me: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/admin');
  handlers['/admin'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /admin load failed', err);
  if (!bootFailure) bootFailure = '/admin: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/projects');
  handlers['/projects'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /projects load failed', err);
  if (!bootFailure) bootFailure = '/projects: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/submit-project');
  handlers['/submit-project'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /submit-project load failed', err);
  if (!bootFailure) bootFailure = '/submit-project: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/my-project-submissions');
  handlers['/my-project-submissions'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /my-project-submissions load failed', err);
  if (!bootFailure) bootFailure = '/my-project-submissions: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/volunteer-calls');
  handlers['/volunteer-calls'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /volunteer-calls load failed', err);
  if (!bootFailure) bootFailure = '/volunteer-calls: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/verify');
  handlers['/verify'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /verify load failed', err);
  if (!bootFailure) bootFailure = '/verify: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/discord');
  handlers['/discord'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /discord load failed', err);
  if (!bootFailure) bootFailure = '/discord: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/discord-username-taken');
  handlers['/discord-username-taken'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /discord-username-taken load failed', err);
  if (!bootFailure) bootFailure = '/discord-username-taken: ' + errorToString(err);
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('./_handlers/contribution-scores');
  handlers['/contribution-scores'] = m.default || m.handler;
} catch (err) {
  console.error('[API][boot] /contribution-scores load failed', err);
  if (!bootFailure) bootFailure = '/contribution-scores: ' + errorToString(err);
}

try {
  if (typeof process !== 'undefined' && typeof (process as any).on === 'function') {
    try {
      (process as any).on('unhandledRejection', (reason: unknown) => {
        console.error('[API][unhandled-rejection]', reason);
      });
      (process as any).on('uncaughtException', (err: unknown) => {
        console.error('[API][uncaught-exception]', err);
      });
    } catch {
      // no-op
    }
  }
} catch (err) {
  if (!bootFailure) bootFailure = errorToString(err);
}

const normalizePath = (req: any): string => {
  try {
    const host = (req.headers?.host as string) || 'localhost';
    const fullUrl = new URL(req.url || '/', `http://${host}`);
    let pathname = fullUrl.pathname;

    const pathQuery = req.query?.path;
    if (typeof pathQuery === 'string' && pathQuery.length > 0) {
      pathname = '/' + pathQuery.replace(/^\/+/, '');
    } else if (Array.isArray(pathQuery) && pathQuery.length > 0) {
      pathname = '/' + pathQuery.join('/');
    }

    if (pathname.startsWith('/api/v1')) {
      pathname = pathname.slice('/api/v1'.length);
    } else if (pathname.startsWith('/api')) {
      pathname = pathname.slice('/api'.length);
    }

    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    return pathname || '/';
  } catch (err) {
    console.error('[API][normalize-path-error]', err);
    return '/';
  }
};

const callHandler = async (name: string, req: any, res: any) => {
  const fn = handlers[name];
  if (!fn) {
    sendError(res, 500, `Handler ${name} failed to load${bootFailure ? ' — ' + bootFailure : ''}`);
    return;
  }
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[API][handler-error]', { name, error: err });
    sendError(res, 500, errorToString(err));
  }
};

async function handleRequest(req: any, res: any) {
  try {
    try {
      res.setHeader('X-API-Version', API_VERSION);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    } catch {
      // headers already sent
    }

    if (bootFailure) {
      sendError(res, 500, bootFailure);
      return;
    }

    if (req.method === 'OPTIONS') {
      try { res.statusCode = 204; res.end(); } catch { /* no-op */ }
      return;
    }

    const pathname = normalizePath(req);

    if (pathname === '/me' || pathname === '/') return callHandler('/me', req, res);
    if (pathname === '/admin') return callHandler('/admin', req, res);
    if (pathname === '/projects') return callHandler('/projects', req, res);
    if (pathname === '/submit-project') return callHandler('/submit-project', req, res);
    if (pathname === '/my-project-submissions') return callHandler('/my-project-submissions', req, res);

    if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) {
      return callHandler('/volunteer-calls', req, res);
    }

    if (pathname.startsWith('/verify')) {
      const parts = pathname.split('/verify/').filter(Boolean);
      if (parts.length > 0) {
        if (!req.query) req.query = {};
        req.query.id = parts[0];
        req.query.memberId = parts[0];
      }
      return callHandler('/verify', req, res);
    }

    if (pathname === '/discord') return callHandler('/discord', req, res);
    if (pathname === '/discord-username-taken') return callHandler('/discord-username-taken', req, res);
    if (pathname === '/contribution-scores') return callHandler('/contribution-scores', req, res);

    sendError(res, 404, 'API endpoint not found');
  } catch (err) {
    console.error('[API][request-error]', { path: req.url, error: err });
    sendError(res, 500, errorToString(err));
  }
}

export default handleRequest;
