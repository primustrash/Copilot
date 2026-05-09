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
import { handleOAuthInitiate, handleOAuthRedirect } from './auth/oauth';
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
  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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
      auth: ['api-key', 'oauth2'],
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
