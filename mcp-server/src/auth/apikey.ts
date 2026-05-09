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

async function authenticateBearerToken(token: string): Promise<{ method: string; principal?: unknown } | null> {
  if (config.auth.allowBearerApiKey && validateApiKey(token)) {
    return { method: 'bearer-api-key' };
  }

  if (config.auth.allowJwtBearer) {
    try {
      return { method: 'jwt', principal: verifyJWT(token) };
    } catch {
      // ignore and try OAuth introspection
    }
  }

  const introspection = await introspectOAuthToken(token);
  if (introspection?.active) {
    return { method: 'oauth2', principal: introspection };
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
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.replace(/^Bearer\s+/i, '');
    const bearerAuth = await authenticateBearerToken(token);
    if (bearerAuth) {
      (req as Request & { auth?: unknown }).auth = bearerAuth;
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

  logger.warn('Authentication failed', { path: req.path, ip: req.ip });
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    supported_methods: ['api-key', 'bearer', 'basic', 'oauth2-jwt'],
  });
}
