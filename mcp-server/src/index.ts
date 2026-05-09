import 'dotenv/config';
import { config } from './utils/config';
import { logger } from './utils/logger';

// Import and register all tools
import './tools/agent/index';
import './tools/agent/tasks';
import './tools/workflow/index';
import './tools/memory/index';
import './tools/memory/project';
import './tools/filesystem/index';
import './tools/desktop/index';
import './tools/audio/index';
import './tools/mouse/index';
import './tools/keyboard/index';
import './tools/apps/index';
import './tools/browser/index';
import './tools/shell/index';
import './tools/ai/index';
import './tools/monitoring/index';
import './tools/security/index';
import './tools/infra/index';
import './tools/repo/index';
import './tools/code/index';
import './tools/git/index';
import './tools/github/index';
import './tools/workspace/index';
import './tools/ide/index';
import './tools/ci/index';
import './tools/review/index';
import './tools/docs/index';

import { createServer } from './server';
import { getToolCount } from './registry';

async function main(): Promise<void> {
  logger.info('Starting MCP Server...');

  const app = createServer();
  const { port, host } = config.server;

  const server = app.listen(port, host, () => {
    logger.info('═══════════════════════════════════════════════════');
    logger.info('  MCP Plug-and-Play Server v1.0.0');
    logger.info('═══════════════════════════════════════════════════');
    logger.info(`  🚀 Server:    http://${host}:${port}`);
    logger.info(`  🔧 Tools:     http://${host}:${port}/mcp/tools`);
    logger.info(`  📡 SSE:       http://${host}:${port}/mcp/sse`);
    logger.info(`  🌊 Stream:    http://${host}:${port}/mcp/stream`);
    logger.info(`  💚 Health:    http://${host}:${port}/health`);
    logger.info(`  📚 Info:      http://${host}:${port}/mcp/info`);
    logger.info(`  🔐 OAuth:     http://${host}:${port}/auth/oauth`);
    logger.info('───────────────────────────────────────────────────');
    logger.info(`  Registered tools: ${getToolCount()}`);
    logger.info(`  Environment:      ${config.server.nodeEnv}`);
    logger.info('═══════════════════════════════════════════════════');
  });

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: (err as Error).message });
  process.exit(1);
});
