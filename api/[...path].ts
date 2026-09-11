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

const sendJson = (res: any, statusCode: number, body: Record<string, unknown>) => {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
  res.end(JSON.stringify(body));
};

const sendError = (res: any, statusCode: number, message: string) =>
  sendJson(res, statusCode, { error: message });

const normalizePath = (req: any): string => {
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
};

const route = async (req: any, res: any, pathname: string) => {
  if (pathname === '/me' || pathname === '/') return meHandler(req, res);
  if (pathname === '/admin') return adminHandler(req, res);
  if (pathname === '/projects') return projectsHandler(req, res);
  if (pathname === '/submit-project') return submitProjectHandler(req, res);
  if (pathname === '/my-project-submissions') return myProjectSubmissionsHandler(req, res);
  if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) return volunteerCallsHandler(req, res);

  if (pathname.startsWith('/verify')) {
    const parts = pathname.split('/verify/').filter(Boolean);
    if (parts.length > 0) {
      if (!req.query) req.query = {};
      req.query.id = parts[0];
      req.query.memberId = parts[0];
    }
    return verifyHandler(req, res);
  }

  if (pathname === '/discord') return discordHandler(req, res);
  if (pathname === '/discord-username-taken') return discordUsernameTakenHandler(req, res);
  if (pathname === '/contribution-scores') return contributionScoresHandler(req, res);

  sendError(res, 404, 'API endpoint not found');
};

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('X-API-Version', API_VERSION);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const pathname = normalizePath(req);
    await route(req, res, pathname);
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
        ? (err as any).message
        : 'Internal server error';
    console.error('[API][route-error]', { path: req.url, error: err });
    sendError(res, 500, msg);
  }
}
