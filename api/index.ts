/**
 * api/index.ts
 * Main router and Vercel/Serverless entrypoint
 * Lightweight: parses path, delegates to handler map, exports entrypoint
 */

import { LIB_API_VERSION, getSupabaseConfig } from './_lib/config';
import { sendError, errorToString } from './_lib/http';
import { handler_me } from './_handlers/me';
import { handler_admin } from './_handlers/admin';
import { handler_projects } from './_handlers/projects';
import { handler_submit_project } from './_handlers/submit-project';
import { handler_my_project_submissions } from './_handlers/my-project-submissions';
import { handler_volunteer_calls } from './_handlers/volunteer-calls';
import { handler_verify } from './_handlers/verify';
import { handler_discord } from './_handlers/discord';
import { handler_discord_username_taken } from './_handlers/discord-username-taken';
import { handler_contribution_scores } from './_handlers/contribution-scores';
import type { H } from './_lib/types';

// ============================================================================
//  Boot-time error handling
// ============================================================================

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
      /* noop */
    }
  }
} catch (err) {
  bootFailure = errorToString(err);
}

// ============================================================================
//  Path normalization
// ============================================================================

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
    if (pathname.startsWith('/api/v1')) pathname = pathname.slice('/api/v1'.length);
    else if (pathname.startsWith('/api')) pathname = pathname.slice('/api'.length);
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return pathname || '/';
  } catch (err) {
    console.error('[API][normalize-path-error]', err);
    return '/';
  }
};

// ============================================================================
//  Handler registry
// ============================================================================

type HandlerKey =
  | '/me'
  | '/admin'
  | '/projects'
  | '/submit-project'
  | '/my-project-submissions'
  | '/volunteer-calls'
  | '/verify'
  | '/discord'
  | '/discord-username-taken'
  | '/contribution-scores';

const HANDLERS: Record<HandlerKey, H> = {
  '/me': handler_me,
  '/admin': handler_admin,
  '/projects': handler_projects,
  '/submit-project': handler_submit_project,
  '/my-project-submissions': handler_my_project_submissions,
  '/volunteer-calls': handler_volunteer_calls,
  '/verify': handler_verify,
  '/discord': handler_discord,
  '/discord-username-taken': handler_discord_username_taken,
  '/contribution-scores': handler_contribution_scores,
};

const callHandler = async (key: HandlerKey, req: any, res: any) => {
  const fn = HANDLERS[key];
  if (!fn) {
    sendError(res, 500, `Handler ${key} not registered`);
    return;
  }
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[API][handler-error]', { key, error: err });
    sendError(res, 500, errorToString(err));
  }
};

// ============================================================================
//  Main request handler
// ============================================================================

async function handleRequest(req: any, res: any) {
  try {
    try {
      res.setHeader('X-API-Version', LIB_API_VERSION);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    } catch {
      /* headers already sent */
    }

    if (bootFailure) {
      sendError(res, 500, bootFailure);
      return;
    }

    if (req.method === 'OPTIONS') {
      try {
        res.statusCode = 204;
        res.end();
      } catch {
        /* noop */
      }
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
      if (pathname.startsWith('/verify/')) {
        const idFromPath = pathname.slice('/verify/'.length).trim();
        if (idFromPath) {
          if (!req.query) req.query = {};
          if (!req.query.id) req.query.id = idFromPath;
          if (!req.query.memberId) req.query.memberId = idFromPath;
        }
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
