import meHandler from './handlers/me';
import adminHandler from './handlers/admin';
import projectsHandler from './handlers/projects';
import submitProjectHandler from './handlers/submit-project';
import myProjectSubmissionsHandler from './handlers/my-project-submissions';
import volunteerCallsHandler from './handlers/volunteer-calls';
import verifyHandler from './handlers/verify';
import discordHandler from './handlers/discord';
import discordUsernameTakenHandler from './handlers/discord-username-taken';
import contributionScoresHandler from './handlers/contribution-scores';

export default async function handler(req: any, res: any) {
  // Always set API version and CORS headers
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Determine URL path
  const host = req.headers?.host || 'localhost';
  const fullUrl = new URL(req.url || '/', `http://${host}`);
  let pathname = fullUrl.pathname;

  // If Vercel passed path via query (from rewrite dest: /api/[...path]?path=$1)
  const pathQuery = req.query?.path;
  if (typeof pathQuery === 'string' && pathQuery.length > 0) {
    pathname = '/' + pathQuery.replace(/^\/+/, '');
  } else if (Array.isArray(pathQuery) && pathQuery.length > 0) {
    pathname = '/' + pathQuery.join('/');
  }

  // Normalize pathname: remove leading /api/v1 or /api
  if (pathname.startsWith('/api/v1')) {
    pathname = pathname.slice('/api/v1'.length);
  } else if (pathname.startsWith('/api')) {
    pathname = pathname.slice('/api'.length);
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Handle route matching
  if (pathname === '/me' || pathname === '') {
    return meHandler(req, res);
  }
  if (pathname === '/admin') {
    return adminHandler(req, res);
  }
  if (pathname === '/projects') {
    return projectsHandler(req, res);
  }
  if (pathname === '/submit-project') {
    return submitProjectHandler(req, res);
  }
  if (pathname === '/my-project-submissions') {
    return myProjectSubmissionsHandler(req, res);
  }
  if (pathname === '/volunteer-calls' || pathname.startsWith('/volunteer-calls/')) {
    return volunteerCallsHandler(req, res);
  }
  if (pathname.startsWith('/verify')) {
    // Extract ID from pathname e.g. /verify/BGPH-2026-001
    const parts = pathname.split('/verify/').filter(Boolean);
    if (parts.length > 0) {
      if (!req.query) req.query = {};
      req.query.id = parts[0];
      req.query.memberId = parts[0];
    }
    return verifyHandler(req, res);
  }
  if (pathname === '/discord') {
    return discordHandler(req, res);
  }
  if (pathname === '/discord-username-taken') {
    return discordUsernameTakenHandler(req, res);
  }
  if (pathname === '/contribution-scores') {
    return contributionScoresHandler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'API endpoint not found' }));
}
