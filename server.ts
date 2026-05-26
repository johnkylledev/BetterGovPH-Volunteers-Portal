import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_DIR = path.join(__dirname, 'api');

interface ExtendedRequest extends http.IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: any;
}

interface ExtendedResponse extends http.ServerResponse {
  status(code: number): ExtendedResponse;
  json(data: any): void;
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function createExtendedRequest(req: http.IncomingMessage, url: URL): ExtendedRequest {
  const extended = req as ExtendedRequest;
  const query: Record<string, string | string[] | undefined> = {};
  
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  
  extended.query = query;
  extended.body = {};
  return extended;
}

function createExtendedResponse(res: http.ServerResponse): ExtendedResponse {
  const extended = res as ExtendedResponse;
  
  extended.status = (code: number) => {
    res.statusCode = code;
    return extended;
  };
  
  extended.json = (data: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  
  return extended;
}

function pathToFileURL(filePath: string): string {
  if (process.platform === 'win32') {
    return 'file:///' + filePath.replace(/\\/g, '/');
  }
  return 'file://' + filePath;
}

async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const apiFile = pathname.replace('/api/', '').replace('/', '');
  const apiPath = path.join(API_DIR, `${apiFile}.ts`);

  if (!fs.existsSync(apiPath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }

  const extendedReq = createExtendedRequest(req, url);
  const extendedRes = createExtendedResponse(res);

  try {
    const body = await parseBody(req);
    extendedReq.body = body;

    const fileUrl = pathToFileURL(path.resolve(apiPath));
    const mod = await import(fileUrl);
    const handlerFn = mod.default;

    if (typeof handlerFn !== 'function') {
      throw new Error('Invalid API handler');
    }

    await handlerFn(extendedReq, extendedRes);
  } catch (err: any) {
    console.error(`API Error: ${pathname}`, err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error', details: err.message }));
  }
}

const server = http.createServer(handler);

server.listen(3001, () => {
  console.log('API server running on http://localhost:3001');
});