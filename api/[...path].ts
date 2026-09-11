type Handler = (req: any, res: any) => Promise<void> | void;

const HANDLER_PATHS: Record<string, string> = {
  '/me': './_handlers/me',
  '/admin': './_handlers/admin',
  '/projects': './_handlers/projects',
  '/submit-project': './_handlers/submit-project',
  '/my-project-submissions': './_handlers/my-project-submissions',
  '/volunteer-calls': './_handlers/volunteer-calls',
  '/verify': './_handlers/verify',
  '/discord': './_handlers/discord',
  '/discord-username-taken': './_handlers/discord-username-taken',
  '/contribution-scores': './_handlers/contribution-scores',
};

let handlerCache: Map<string, Handler> | null = null;

const getHandlerCache = () => {
  if (!handlerCache) handlerCache = new Map<string, Handler>();
  return handlerCache;
};

const loadHandler = async (key: string, importPath: string): Promise<Handler> => {
  const cache = getHandlerCache();
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const mod = await import(/* @vite-ignore */ importPath);
    const fn: Handler =
      typeof mod.default === 'function'
        ? mod.default
        : typeof mod.handler === 'function'
          ? mod.handler
          : null;
    if (!fn) throw new Error(`Handler ${key} has no default export`);
    cache.set(key, fn);
    return fn;
  } catch (err) {
    console.error('[API][import-error]', { key, importPath, error: err });
    throw err;
  }
};

const API_VERSION = '1.0.0';

const sendJson = (res: any, statusCode: number, body: Record<string, unknown>) => {
  try {
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
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Response write failed' }));
      } else if (!res.writableEnded) {
        res.end();
      }
    } catch {
      // no-op
    }
  }
};

const sendError = (res: any, statusCode: number, message: string) =>
  sendJson(res, statusCode, { error: message });

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

const route = async (req: any, res: any, pathname: string) => {
  if (pathname === '/me' || pathname === '/') {
    return loadHandler('/me', HANDLER_PATHS['/me']).then((h) => h(req, res));
  }
  if (pathname === '/admin') {
    return loadHandler('/admin', HANDLER_PATHS['/admin']).then((h) => h(req, res));
  }
  if (pathname === '/projects') {
    return loadHandler('/projects', HANDLER_PATHS['/projects']).then((h) => h(req, res));
  }
  if (pathname === '/submit-project') {
    return loadHandler('/submit-project', HANDLER_PATHS['/submit-project']).then((h) => h(req, res));
  }
  if (pathname === '/my-project-submissions') {
    return loadHandler('/my-project-submissions', HANDLER_PATHS['/my-project-submissions']).then((h) => h(req, res));
  }
  if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) {
    return loadHandler('/volunteer-calls', HANDLER_PATHS['/volunteer-calls']).then((h) => h(req, res));
  }

  if (pathname.startsWith('/verify')) {
    const parts = pathname.split('/verify/').filter(Boolean);
    if (parts.length > 0) {
      if (!req.query) req.query = {};
      req.query.id = parts[0];
      req.query.memberId = parts[0];
    }
    return loadHandler('/verify', HANDLER_PATHS['/verify']).then((h) => h(req, res));
  }

  if (pathname === '/discord') {
    return loadHandler('/discord', HANDLER_PATHS['/discord']).then((h) => h(req, res));
  }
  if (pathname === '/discord-username-taken') {
    return loadHandler('/discord-username-taken', HANDLER_PATHS['/discord-username-taken']).then((h) => h(req, res));
  }
  if (pathname === '/contribution-scores') {
    return loadHandler('/contribution-scores', HANDLER_PATHS['/contribution-scores']).then((h) => h(req, res));
  }

  sendError(res, 404, 'API endpoint not found');
};

let bootError: string | null = null;

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
} catch {
  bootError = 'Boot hook init failed';
}

async function handleRequest(req: any, res: any) {
  try {
    if (bootError) {
      sendError(res, 500, bootError);
      return;
    }

    try {
      res.setHeader('X-API-Version', API_VERSION);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    } catch {
      // headers already sent
    }

    if (req.method === 'OPTIONS') {
      try {
        res.statusCode = 204;
        res.end();
      } catch {
        // no-op
      }
      return;
    }

    const pathname = normalizePath(req);
    await route(req, res, pathname);
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
        ? String((err as any).message)
        : 'Internal server error';
    console.error('[API][route-error]', { path: req.url, error: err });
    sendError(res, 500, msg);
  }
}

export default handleRequest;
