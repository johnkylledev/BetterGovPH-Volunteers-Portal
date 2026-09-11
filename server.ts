import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_DIR = path.join(__dirname, 'api');

const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim())
  : ['localhost:3000', 'localhost:3001', 'bettergovph-access-card.vercel.app'];

const isHostAllowed = (host: string | undefined): boolean => {
  if (!host) return false;
  if (ALLOWED_HOSTS.includes(host)) return true;
  if (host.endsWith('.vercel.app')) return true;
  return false;
};

interface ExtendedRequest extends http.IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: any;
}

interface ExtendedResponse extends http.ServerResponse {
  status(code: number): ExtendedResponse;
  json(data: any): void;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 60_000);

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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-API-Version', '1.0.0');

  const host = req.headers.host;
  if (!isHostAllowed(host)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    if (!pathname.startsWith('/api/')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const relativePath = pathname.replace(/^\/api\/(v1\/)?/, '');
    const parts = relativePath.split('?')[0].split('/').filter(Boolean);
    const apiFile = parts[0] || '';
    const pathIdParam = parts[1] || '';

    const apiPath = path.join(API_DIR, `${apiFile}.ts`);

    if (!fs.existsSync(apiPath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-API-Version', '1.0.0');
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
      return;
    }

    const extendedReq = createExtendedRequest(req, url);
    if (pathIdParam && !extendedReq.query.id && !extendedReq.query.memberId) {
      extendedReq.query.id = pathIdParam;
    }
    const extendedRes = createExtendedResponse(res);

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
    console.error(`API Error: ${req.url} - ${err.message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

const server = http.createServer(handler);

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`
                                             %                                                      
                                            %%%%                                                    
                                           %%%%%%                                                   
                                        %  %%%%%                                                    
                                      %%%  %%%%%  %%%                                               
                                      %%%  %%%%%  %%%                                               
                                      %%%  %%%%%  %%%                                               
                                      %%%% %%%%%  %%%                                               
            %%%%%   %%%%               %%%  %%%%  %%%              %%%%   %%%%%                     
            %%%%%%%  %%%%%             %%%  %%%%  %%%             %%%%  %%%%%%%                     
            %%%%%%%%   %%%%            %%%  %%%  %%%            %%%%%  %%%%%%%%                     
              %%%%%%%%  %%%%           %%%  %%%  %%%           %%%%  %%%%%%%%                       
            %%  %%%%%%%%  %%%%          %%  %%%  %%%         %%%%%  %%%%%%%  %%                     
            %%%%   %%%%%%  %%%%         %%  %%%  %%%        %%%%  %%%%%%%  %%%%                     
             %%%%%   %%%%%%  %%%%      %%%%%%%%%%%%%       %%%%  %%%%%%  %%%%%%                     
               %%%%%   %%%%%  %%%% %%%%%%%%%%%%%%%%%%%%% %%%%  %%%%%%  %%%%%%                       
                 %%%%%   %%%%%  %%%%%%%%%%%%%%%%%%%%%%%%%%%   %%%%   %%%%%                          
        %%%%%%      %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%   %%%%%                            
          %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%%%%%                              
              %%%%%%%%%                 %%%%%%%%%%%%%%%%%%%%%%%%%%%                                 
                                         %%%%%%%%%%%%%%%%%%%%%%%%                                   
                                          %%%%%%%%%%%%%%%%%%%%%%%%                                  
                    %%%%%%%%%%%%%%%%%%%%   %%%%%%%%%%%%%%%%%%%%%%%%         %%%%%%%%%%              
                %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%             
       %%  %%%%%%%%%%%%%%%%%   %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%                     
        %%%%%%%%%% %%%%%%%%%%      %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% %%%%%%%%%%%%%%%%%%%%%%%        
         %%%%%%%   %%%%%%%%%%%        %%%%              %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%       
           %%%%%%%%%%%%%%%%%%%%%%%%%%  %%%%                %%%%%%%%% %%%%%%%%%%%%%%%%%%%%%%         
              %%%%%%%%%%%%%%%%%%%%%%%  %%%%                   %%%%%%%%%%%%%%%%%                     
             %%%%    %%%%%%%%%%%%%    %%%%                     %%%%%%%%%%%%%%%%%%%%%%%%             
           %%%%%%%                    %%%%                      %%%%          %%%%%%%%              
            %%%%%%%                 %%%%%                        %%%%                               
             %%%%%%%               %%%%%                          %%%                               
             %%%%%%%%             %%%%%%    %%                    %%%%                              
              %%%%  %%%          %%%%%%%%%%%%                      %%%                              
                  %%%%%%%        %%%%%%%%%%%                       %%%%                             
                 %%%   %%%%      %%%% %%                            %%%                             
                      %%%%%%%    %%%%%%%%      %%%%%%%%%%%%%%%%%%%%%%%%                             
                     %%% %%%%%%%  %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%                             
                        %%%%% %%%%  %%%%%%%%%%%%%%%%         %% %%%%%%%                             
                        %%%% %%%%%%%%%%%              %%%%%  %%     %%%%                            
                            %%%%%%%% %%%%%%%%%%% %%  %%%%%%%%%%%      %%                            
                               %% %%%%%%%% %%%%% %%  %%%%%%%% %%                                    
                                   %%%  %%%%%  %%% %% %%   %%                                       
                                               %%%  %                                               
  `);
});
