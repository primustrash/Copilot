import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

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

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check and OAuth endpoints
  const skipPaths = ['/health', '/auth/oauth', '/auth/callback', '/mcp/sse'];
  if (skipPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const apiKey =
    (req.headers['x-api-key'] as string) ||
    (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');

  if (!apiKey) {
    logger.warn('Missing API key', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Missing API key', code: 'UNAUTHORIZED' });
    return;
  }

  if (!validateApiKey(apiKey)) {
    logger.warn('Invalid API key', { path: req.path, ip: req.ip });
    res.status(403).json({ error: 'Invalid API key', code: 'FORBIDDEN' });
    return;
  }

  next();
}
