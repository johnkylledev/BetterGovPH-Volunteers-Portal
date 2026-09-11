import meHandler from './_handlers/me';
import adminHandler from './_handlers/admin';
import projectsHandler from './_handlers/projects';
import submitProjectHandler from './_handlers/submit-project';
import myProjectSubmissionsHandler from './_handlers/my-project-submissions';
import volunteerCallsHandler from './_handlers/volunteer-calls';
import verifyHandler from './_handlers/verify';
import discordHandler from './_handlers/discord';
import discordUsernameTakenHandler from './_handlers/discord-username-taken';
import contributionScoresHandler from './_handlers/contribution-scores';

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
  bootFailure = errorToString(err);
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

const callHandler = async (name: string, fn: any, req: any, res: any) => {
  if (!fn) {
    sendError(res, 500, `Handler ${name} failed to load`);
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
    if (bootFailure) {
      sendError(res, 500, bootFailure);
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
      try { res.statusCode = 204; res.end(); } catch { /* no-op */ }
      return;
    }

    const pathname = normalizePath(req);

    if (pathname === '/me' || pathname === '/') return callHandler('/me', meHandler, req, res);
    if (pathname === '/admin') return callHandler('/admin', adminHandler, req, res);
    if (pathname === '/projects') return callHandler('/projects', projectsHandler, req, res);
    if (pathname === '/submit-project') return callHandler('/submit-project', submitProjectHandler, req, res);
    if (pathname === '/my-project-submissions') return callHandler('/my-project-submissions', myProjectSubmissionsHandler, req, res);

    if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) {
      return callHandler('/volunteer-calls', volunteerCallsHandler, req, res);
    }

    if (pathname.startsWith('/verify')) {
      const parts = pathname.split('/verify/').filter(Boolean);
      if (parts.length > 0) {
        if (!req.query) req.query = {};
        req.query.id = parts[0];
        req.query.memberId = parts[0];
      }
      return callHandler('/verify', verifyHandler, req, res);
    }

    if (pathname === '/discord') return callHandler('/discord', discordHandler, req, res);
    if (pathname === '/discord-username-taken') return callHandler('/discord-username-taken', discordUsernameTakenHandler, req, res);
    if (pathname === '/contribution-scores') return callHandler('/contribution-scores', contributionScoresHandler, req, res);

    sendError(res, 404, 'API endpoint not found');
  } catch (err) {
    console.error('[API][request-error]', { path: req.url, error: err });
    sendError(res, 500, errorToString(err));
  }
}

export default handleRequest;
