const API_VERSION = '1.0.0';

let bootFailure: string | null = null;

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
  bootFailure =
    err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
      ? String((err as any).message)
      : 'Boot hook init failed';
}

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

type HandlerKey = keyof typeof handlers;

// --- Handler loader: uses LITERAL-STRING dynamic import() calls. ---
// Vercel's esbuild statically traces literal-string `import('./foo')` expressions
// and INCLUDES those targets in the Lambda bundle (variable-path dynamic imports
// are NOT included). Using per-key literal case arms ensures every file is bundled.
// Also: no module-level load executes at module instantiation → no FUNCTION_INVOCATION_FAILED
// crashes from a top-level import chain error. First request lazily loads everything.
const loadAllHandlers = async (): Promise<void> => {
  let all: HandlerKey[] | null = null as unknown as HandlerKey[] | null;
  for (const k of Object.keys(handlers) as HandlerKey[]) {
    if (handlers[k] === null) {
      all = all || (Object.keys(handlers) as HandlerKey[]);
      break;
    }
  }
  if (!all) return;
  const failures: string[] = [];
  await Promise.all(
    all.map(async (key) => {
      try {
        let mod: any;
        switch (key) {
          case '/me':
            mod = await import('./_handlers/me');
            break;
          case '/admin':
            mod = await import('./_handlers/admin');
            break;
          case '/projects':
            mod = await import('./_handlers/projects');
            break;
          case '/submit-project':
            mod = await import('./_handlers/submit-project');
            break;
          case '/my-project-submissions':
            mod = await import('./_handlers/my-project-submissions');
            break;
          case '/volunteer-calls':
            mod = await import('./_handlers/volunteer-calls');
            break;
          case '/verify':
            mod = await import('./_handlers/verify');
            break;
          case '/discord':
            mod = await import('./_handlers/discord');
            break;
          case '/discord-username-taken':
            mod = await import('./_handlers/discord-username-taken');
            break;
          case '/contribution-scores':
            mod = await import('./_handlers/contribution-scores');
            break;
          default:
            break;
        }
        if (!mod) throw new Error('Import arm missing for ' + key);
        const fn: Handler = typeof mod.default === 'function' ? mod.default : mod.handler;
        if (!fn) throw new Error('Handler ' + key + ' has no default export');
        handlers[key] = fn;
      } catch (err) {
        console.error('[API][import] ' + key + ' load failed', err);
        failures.push(key + ': ' + errorToString(err));
      }
    })
  );
  if (failures.length > 0 && !bootFailure) {
    bootFailure = failures.join(' | ');
  }
};

let handlersLoading: Promise<void> | null = null;
const ensureHandlers = (): Promise<void> => {
  if (!handlersLoading) handlersLoading = loadAllHandlers();
  return handlersLoading;
};

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

const callHandler = async (key: HandlerKey, req: any, res: any) => {
  try {
    await ensureHandlers();
  } catch (err) {
    console.error('[API][ensure-handlers-failed]', err);
    if (!bootFailure) bootFailure = errorToString(err);
  }
  const fn = handlers[key];
  if (!fn) {
    sendError(res, 500, `Handler ${key} failed to load${bootFailure ? ' — ' + bootFailure : ''}`);
    return;
  }
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[API][handler-error]', { key, error: err });
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
