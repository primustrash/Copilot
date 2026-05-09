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
import { getToolCount } from './registry';

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
  app.use(morgan('combined', {
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

  // SSE endpoint (light auth)
  app.get('/mcp/sse', (req, res) => {
    const clientId = setupSSE(req, res);
    logger.info('SSE connection established', { clientId });
  });

  // Apply API key auth to all /mcp routes
  app.use('/mcp', apiKeyMiddleware);

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

  // Kill switch endpoint
  app.post('/admin/kill-switch', handleKillSwitch);

  // Server-sent Events broadcast endpoint (admin)
  app.post('/admin/broadcast', (req, res) => {
    const { event, data } = req.body as { event: string; data: unknown };
    const { broadcastSSE } = require('./transport/sse');
    broadcastSSE(event, data);
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
