import { Request, Response } from 'express';
import { logger } from '../utils/logger';

interface StreamSession {
  id: string;
  chunks: string[];
  complete: boolean;
  createdAt: Date;
}

const sessions = new Map<string, StreamSession>();

export function createStreamSession(): string {
  const sessionId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  sessions.set(sessionId, {
    id: sessionId,
    chunks: [],
    complete: false,
    createdAt: new Date(),
  });
  return sessionId;
}

export function appendToStream(sessionId: string, chunk: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.chunks.push(chunk);
  }
}

export function completeStream(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.complete = true;
  }
}

export async function handleStreamableHTTP(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const { tool, input } = req.body as { tool: string; input: unknown };

  if (!tool) {
    res.status(400).json({ error: 'Missing tool parameter' });
    return;
  }

  logger.debug('Streamable HTTP request', { tool, input });

  // Send initial response header
  res.write(JSON.stringify({
    type: 'start',
    tool,
    timestamp: new Date().toISOString(),
  }) + '\n');

  // The actual tool execution is handled by the router
  // This function sets up the streaming response format
  res.locals.streamMode = true;
  res.locals.tool = tool;
  res.locals.input = input;
}

export function sendStreamChunk(res: Response, data: unknown): void {
  if (!res.writableEnded) {
    res.write(JSON.stringify({ type: 'chunk', data }) + '\n');
  }
}

export function endStream(res: Response, result: unknown): void {
  if (!res.writableEnded) {
    res.write(JSON.stringify({ type: 'end', result }) + '\n');
    res.end();
  }
}

// Cleanup old sessions
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [id, session] of sessions.entries()) {
    if (session.createdAt.getTime() < cutoff) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);
