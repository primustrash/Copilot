import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';

interface SSEClient {
  id: string;
  res: Response;
  topics: Set<string>;
}

const clients = new Map<string, SSEClient>();

export function setupSSE(req: Request, res: Response): string {
  const clientId = `${Date.now()}-${randomBytes(6).toString('hex')}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client: SSEClient = {
    id: clientId,
    res,
    topics: new Set(),
  };

  clients.set(clientId, client);
  logger.info('SSE client connected', { clientId });

  // Send initial connection event
  sendSSEEvent(res, 'connected', { clientId });

  // Keepalive every 30 seconds
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    } else {
      clearInterval(keepAlive);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(clientId);
    logger.info('SSE client disconnected', { clientId });
  });

  return clientId;
}

export function sendSSEEvent(res: Response, event: string, data: unknown): void {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function broadcastSSE(event: string, data: unknown, topic?: string): void {
  for (const client of clients.values()) {
    if (!topic || client.topics.has(topic)) {
      sendSSEEvent(client.res, event, data);
    }
  }
}

export function subscribeClientToTopic(clientId: string, topic: string): boolean {
  const client = clients.get(clientId);
  if (!client) return false;
  client.topics.add(topic);
  return true;
}

export function getConnectedClients(): number {
  return clients.size;
}
