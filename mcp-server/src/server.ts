import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

import { config } from './utils/config';
import { logger } from './utils/logger';
import { apiKeyMiddleware } from './auth/apikey';
import { handleOAuthInitiate, handleOAuthMetadata, handleOAuthRedirect, handleOAuthTokenExchange } from './auth/oauth';
import { setupSSE, sendSSEEvent, getConnectedClients } from './transport/sse';
import {
  handleToolCall,
  handleToolsList,
  handleCategoriesList,
  handleCategoryTools,
  handleResourcesList,
  handlePromptsList,
  handlePromptsGet,
  handleKillSwitch,
} from './router';
import { getToolCount, searchTools } from './registry';

export function createServer(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS - restrict to configured allowed origins
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  if (allowedOrigins.length === 0) {
    logger.warn('CORS_ALLOWED_ORIGINS not set - CORS is disabled. Set this env variable to allow cross-origin access.');
  }
  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'API-Key', 'X-Auth-Token', ...config.auth.acceptedApiKeyHeaders],
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(morgan(':method :status :res[content-length] :response-time ms', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));

  // Body parsing
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
  });
  app.use('/mcp', limiter);
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests', code: 'AUTH_RATE_LIMIT_EXCEEDED' },
  });
  app.use('/auth', authLimiter);

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      tools: getToolCount(),
      sse_clients: getConnectedClients(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // OAuth endpoints (no auth required)
  app.get('/auth/oauth', handleOAuthInitiate);
  app.get('/auth/callback', handleOAuthRedirect);
  app.post('/auth/token', handleOAuthTokenExchange);
  app.get('/auth/methods', (_req, res) => {
    res.json({
      methods: [
        { type: 'api-key', headers: config.auth.acceptedApiKeyHeaders },
        { type: 'bearer', schemes: ['Bearer', 'Token', 'ApiKey'], accepts: ['api-key', 'jwt', 'oauth2-access-token'] },
        { type: 'basic', enabled: config.auth.allowBasicAuth },
        {
          type: 'query-token',
          enabled: config.auth.allowQueryTokenAuth,
          params: config.auth.acceptedQueryTokenParams,
        },
        {
          type: 'body-token',
          enabled: config.auth.allowBodyTokenAuth,
          fields: config.auth.acceptedBodyTokenFields,
        },
        {
          type: 'cookie-token',
          enabled: config.auth.allowCookieTokenAuth,
          cookies: config.auth.acceptedCookieNames,
        },
        {
          type: 'oauth2',
          authorization_url: config.auth.oauth.authUrl,
          token_url: config.auth.oauth.tokenUrl,
          grant_types: config.auth.oauth.grantTypes,
          scopes: config.auth.oauth.scopes,
          endpoints: ['/auth/oauth', '/auth/callback', '/auth/token'],
          configured: Boolean(config.auth.oauth.authUrl && config.auth.oauth.tokenUrl && config.auth.oauth.clientId),
        },
      ],
      remote_profiles: {
        primusnex: {
          mcp_url: config.auth.remoteProfiles.primusnex.mcpUrl,
          api_key_header: config.auth.remoteProfiles.primusnex.apiKeyHeader,
          oauth_authorization_url: config.auth.remoteProfiles.primusnex.oauthAuthUrl,
          oauth_token_url: config.auth.remoteProfiles.primusnex.oauthTokenUrl,
          client_id_configured: Boolean(config.auth.remoteProfiles.primusnex.clientId),
          client_secret_configured: Boolean(config.auth.remoteProfiles.primusnex.clientSecret),
        },
      },
    });
  });
  app.get('/.well-known/oauth-authorization-server', handleOAuthMetadata);

  // Authenticate before creating an SSE session. The old public SSE route
  // bypassed the /mcp middleware entirely.
  app.use('/mcp', apiKeyMiddleware);
  app.get('/mcp/sse', (req, res) => {
    const clientId = setupSSE(req, res);
    logger.info('Authenticated SSE connection established', { clientId });
  });

  // MCP Protocol endpoints
  app.post('/mcp/tools/call', handleToolCall);
  app.get('/mcp/tools', handleToolsList);
  app.get('/mcp/tools/list', handleToolsList);
  app.get('/mcp/categories', handleCategoriesList);
  app.get('/mcp/categories/:category/tools', handleCategoryTools);
  app.get('/mcp/resources', handleResourcesList);
  app.get('/mcp/resources/list', handleResourcesList);
  app.get('/mcp/prompts', handlePromptsList);
  app.get('/mcp/prompts/list', handlePromptsList);
  app.get('/mcp/prompts/:name', handlePromptsGet);

  // Streamable HTTP endpoint
  app.post('/mcp/stream', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const { tool, input } = req.body as { tool: string; input: unknown };
    if (!tool) {
      res.status(400).json({ error: 'Missing tool parameter' });
      return;
    }

    try {
      const { executeTool } = await import('./registry');
      res.write(JSON.stringify({ type: 'start', tool }) + '\n');
      const result = await executeTool(tool, input ?? {});
      res.write(JSON.stringify({ type: 'end', result }) + '\n');
      res.end();
    } catch (err) {
      res.write(JSON.stringify({ type: 'error', error: (err as Error).message }) + '\n');
      res.end();
    }
  });

  // MCP Tool search endpoint
  app.get('/mcp/tools/search', (req, res) => {
    const { q } = req.query as { q?: string };
    if (!q) {
      res.status(400).json({ error: 'Missing query parameter: q' });
      return;
    }
    const results = searchTools(q).map(t => ({ name: t.name, description: t.description, category: t.category }));
    res.json({ query: q, results, count: results.length });
  });

  // Metrics endpoint with real system info
  app.get('/mcp/metrics', (_req, res) => {
    const mem = process.memoryUsage();
    const os = require('os') as typeof import('os');
    res.json({
      server: {
        uptime_seconds: process.uptime(),
        tools: getToolCount(),
        sse_clients: getConnectedClients(),
        node_version: process.version,
      },
      process: {
        pid: process.pid,
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024),
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpu_cores: os.cpus().length,
        load_avg: os.loadavg(),
        total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
        free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // All administrative routes require primary authentication. A secondary,
  // independently configured scoped token is required for broadcasts.
  app.use('/admin', apiKeyMiddleware);
  app.post('/admin/kill-switch', handleKillSwitch);

  // Server-sent Events broadcast endpoint (admin)
  app.post('/admin/broadcast', (req, res) => {
    const secret = process.env.MCP_ADMIN_BROADCAST_TOKEN;
    if (!secret || secret.length < 32) {
      res.status(503).json({ error: 'Admin broadcast not configured' });
      return;
    }
    const submitted = req.get('x-admin-broadcast-token') || '';
    const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
    const a = Buffer.from(secret, 'utf8');
    const b = Buffer.from(submitted, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Admin broadcast forbidden' });
      return;
    }
    const body = req.body as { event?: unknown; data?: unknown } | undefined;
    if (!body || !['operator_notice', 'session_health'].includes(String(body.event))) {
      res.status(400).json({ error: 'Invalid broadcast event' });
      return;
    }
    let encoded: string | undefined;
    try { encoded = JSON.stringify(body.data); } catch { encoded = undefined; }
    if (!encoded || Buffer.byteLength(encoded, 'utf8') > 2048) {
      res.status(400).json({ error: 'Invalid broadcast payload' });
      return;
    }
    const { broadcastSSE } = require('./transport/sse');
    broadcastSSE(String(body.event), body.data);
    res.json({ success: true, clients: getConnectedClients() });
  });

  // MCP Info endpoint
  app.get('/mcp/info', (_req, res) => {
    res.json({
      name: 'MCP Plug-and-Play Server',
      version: '1.0.0',
      description: 'Full-featured MCP server with all tool categories',
      tools: getToolCount(),
      transport: ['sse', 'streamable-http', 'json-rpc'],
      auth: {
        methods: ['api-key', 'bearer', 'basic', 'query-token', 'body-token', 'cookie-token', 'oauth2'],
        api_key_headers: config.auth.acceptedApiKeyHeaders,
        query_token: {
          enabled: config.auth.allowQueryTokenAuth,
          params: config.auth.acceptedQueryTokenParams,
        },
        body_token: {
          enabled: config.auth.allowBodyTokenAuth,
          fields: config.auth.acceptedBodyTokenFields,
        },
        cookie_token: {
          enabled: config.auth.allowCookieTokenAuth,
          cookies: config.auth.acceptedCookieNames,
        },
        oauth: {
          authorization_url: config.auth.oauth.authUrl,
          token_url: config.auth.oauth.tokenUrl,
          scopes: config.auth.oauth.scopes,
          grant_types: config.auth.oauth.grantTypes,
        },
      },
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
