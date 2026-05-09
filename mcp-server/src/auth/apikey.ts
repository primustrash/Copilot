import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { introspectOAuthToken, verifyJWT } from './oauth';

const VALID_API_KEYS = new Set<string>();

// Initialize with env-based API key
if (config.auth.apiKeySecret && config.auth.apiKeySecret !== 'default-secret-change-me') {
  VALID_API_KEYS.add(config.auth.apiKeySecret);
}

export function addApiKey(key: string): void {
  VALID_API_KEYS.add(key);
}

export function removeApiKey(key: string): void {
  VALID_API_KEYS.delete(key);
}

export function validateApiKey(key: string): boolean {
  return VALID_API_KEYS.has(key);
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const value = req.headers[headerName.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function extractBasicCredentials(header: string | undefined): { username?: string; password?: string } {
  if (!header?.startsWith('Basic ')) {
    return {};
  }

  try {
    const decoded = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    return { username, password };
  } catch {
    return {};
  }
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...valueParts] = part.trim().split('=');
    if (!rawKey) return acc;
    const key = decodeURIComponent(rawKey.trim());
    const value = decodeURIComponent(valueParts.join('=').trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function extractAuthorizationToken(header: string | undefined): { scheme?: string; token?: string } {
  if (!header) return {};
  const match = header.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+(.+)$/);
  if (!match) return {};
  return { scheme: match[1]?.toLowerCase(), token: match[2]?.trim() };
}

async function authenticateToken(token: string, methodHint?: string): Promise<{ method: string; principal?: unknown } | null> {
  if (config.auth.allowBearerApiKey && validateApiKey(token)) {
    return { method: methodHint || 'bearer-api-key' };
  }

  if (config.auth.allowJwtBearer) {
    try {
      return { method: methodHint || 'jwt', principal: verifyJWT(token) };
    } catch {
      // ignore and try OAuth introspection
    }
  }

  const introspection = await introspectOAuthToken(token);
  if (introspection?.active) {
    return { method: methodHint || 'oauth2', principal: introspection };
  }

  return null;
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip auth for health check and OAuth endpoints
  const skipPaths = ['/health', '/auth/oauth', '/auth/callback', '/auth/methods', '/.well-known/oauth-authorization-server', '/mcp/sse'];
  if (skipPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  for (const headerName of config.auth.acceptedApiKeyHeaders) {
    const headerValue = getHeaderValue(req, headerName);
    if (headerValue && validateApiKey(headerValue)) {
      (req as Request & { auth?: unknown }).auth = { method: 'api-key', header: headerName };
      next();
      return;
    }
  }

  const authorization = getHeaderValue(req, 'authorization');
  const { scheme, token } = extractAuthorizationToken(authorization);
  if (token && (scheme === 'bearer' || scheme === 'token' || scheme === 'apikey')) {
    const authResult = await authenticateToken(token, `${scheme}-token`);
    if (authResult) {
      (req as Request & { auth?: unknown }).auth = authResult;
      next();
      return;
    }
  }

  if (config.auth.allowBasicAuth) {
    const basic = extractBasicCredentials(authorization);
    const basicCandidate = [basic.password, basic.username].find((value): value is string => Boolean(value));
    if (basicCandidate && validateApiKey(basicCandidate)) {
      (req as Request & { auth?: unknown }).auth = { method: 'basic', username: basic.username || 'api-key' };
      next();
      return;
    }
  }

  if (config.auth.allowQueryTokenAuth) {
    for (const paramName of config.auth.acceptedQueryTokenParams) {
      const candidate = req.query?.[paramName];
      const tokenValue = Array.isArray(candidate) ? candidate[0] : candidate;
      if (typeof tokenValue === 'string' && tokenValue.trim()) {
        const authResult = await authenticateToken(tokenValue.trim(), `query:${paramName}`);
        if (authResult) {
          (req as Request & { auth?: unknown }).auth = authResult;
          next();
          return;
        }
      }
    }
  }

  if (config.auth.allowBodyTokenAuth && req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, unknown>;
    for (const fieldName of config.auth.acceptedBodyTokenFields) {
      const value = body[fieldName];
      if (typeof value === 'string' && value.trim()) {
        const authResult = await authenticateToken(value.trim(), `body:${fieldName}`);
        if (authResult) {
          (req as Request & { auth?: unknown }).auth = authResult;
          next();
          return;
        }
      }
    }
  }

  if (config.auth.allowCookieTokenAuth) {
    const cookieMap = parseCookieHeader(getHeaderValue(req, 'cookie'));
    for (const cookieName of config.auth.acceptedCookieNames) {
      const value = cookieMap[cookieName];
      if (value) {
        const authResult = await authenticateToken(value, `cookie:${cookieName}`);
        if (authResult) {
          (req as Request & { auth?: unknown }).auth = authResult;
          next();
          return;
        }
      }
    }
  }

  logger.warn('Authentication failed', { path: req.path, ip: req.ip });
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    supported_methods: ['api-key-header', 'authorization-bearer/token/apikey', 'basic', 'oauth2-jwt', 'query-token', 'body-token', 'cookie-token'],
  });
}
