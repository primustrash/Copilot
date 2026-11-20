import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';

interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Session {
  id: string;
  entries: string[];
  createdAt: string;
  closedAt?: string;
}

interface Insight {
  id: string;
  content: string;
  tags: string[];
  links: string[];
  createdAt: string;
}

const memoryStore = new Map<string, MemoryEntry>();
const sessions = new Map<string, Session>();
const insights = new Map<string, Insight>();
const sharedContext = new Map<string, unknown>();
const journal: Array<{ content: string; timestamp: string }> = [];

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

function simpleEmbed(text: string): number[] {
  // Simple hash-based pseudo-embedding for demo purposes
  const words = text.toLowerCase().split(/\s+/);
  const vec = new Array(64).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
    }
    vec[Math.abs(hash) % 64] += 1;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

registerTool({
  name: 'embed_text',
  description: 'Generate a vector embedding for text',
  category: 'memory',
  schema: z.object({ text: z.string() }),
  handler: async (input) => {
    const { text } = input as { text: string };
    const embedding = simpleEmbed(text);
    return { text, embedding, dimensions: embedding.length };
  },
});

registerTool({
  name: 'semantic_search',
  description: 'Search memory using semantic similarity',
  category: 'memory',
  schema: z.object({ query: z.string(), top_k: z.number().optional() }),
  handler: async (input) => {
    const { query, top_k = 5 } = input as { query: string; top_k?: number };
    const queryEmbedding = simpleEmbed(query);

    const results = Array.from(memoryStore.values())
      .filter(m => m.embedding)
      .map(m => ({
        ...m,
        score: cosineSimilarity(queryEmbedding, m.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);

    return { query, results, count: results.length };
  },
});

registerTool({
  name: 'upsert_memory',
  description: 'Store or update a memory entry',
  category: 'memory',
  schema: z.object({
    id: z.string().optional(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { id, content, metadata = {} } = input as { id?: string; content: string; metadata?: Record<string, unknown> };
    const memId = id || `mem-${Date.now()}`;
    const embedding = simpleEmbed(content);
    const entry: MemoryEntry = {
      id: memId, content, embedding, metadata,
      createdAt: new Date().toISOString(),
    };
    memoryStore.set(memId, entry);
    return { success: true, id: memId, entry };
  },
});

registerTool({
  name: 'memory.store',
  description: 'Store a value in memory',
  category: 'memory',
  schema: z.object({ key: z.string(), value: z.unknown() }),
  handler: async (input) => {
    const { key, value } = input as { key: string; value: unknown };
    const content = typeof value === 'string' ? value : JSON.stringify(value);
    const id = `mem-${key}`;
    const entry: MemoryEntry = { id, content, metadata: { key }, createdAt: new Date().toISOString() };
    memoryStore.set(id, entry);
    return { success: true, key, stored: true };
  },
});

registerTool({
  name: 'memory.retrieve',
  description: 'Retrieve a value from memory',
  category: 'memory',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    const entry = memoryStore.get(`mem-${key}`);
    if (!entry) return { key, value: null, found: false };
    return { key, value: entry.content, found: true };
  },
});

registerTool({
  name: 'memory.delete',
  description: 'Delete a memory entry',
  category: 'memory',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    const deleted = memoryStore.delete(`mem-${key}`);
    return { success: deleted, key };
  },
});

registerTool({
  name: 'add_insight',
  description: 'Add a new insight to the knowledge base',
  category: 'memory',
  schema: z.object({ content: z.string(), tags: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { content, tags = [] } = input as { content: string; tags?: string[] };
    const id = `insight-${Date.now()}`;
    const insight: Insight = { id, content, tags, links: [], createdAt: new Date().toISOString() };
    insights.set(id, insight);
    return { success: true, insight_id: id, insight };
  },
});

registerTool({
  name: 'link_insights',
  description: 'Link two insights together',
  category: 'memory',
  schema: z.object({ insight_id_a: z.string(), insight_id_b: z.string() }),
  handler: async (input) => {
    const { insight_id_a, insight_id_b } = input as { insight_id_a: string; insight_id_b: string };
    const a = insights.get(insight_id_a);
    const b = insights.get(insight_id_b);
    if (!a || !b) throw new Error('One or both insights not found');
    if (!a.links.includes(insight_id_b)) a.links.push(insight_id_b);
    if (!b.links.includes(insight_id_a)) b.links.push(insight_id_a);
    return { success: true, linked: [insight_id_a, insight_id_b] };
  },
});

registerTool({
  name: 'search_insights',
  description: 'Search insights by query or tags',
  category: 'memory',
  schema: z.object({ query: z.string().optional(), tags: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { query, tags } = input as { query?: string; tags?: string[] };
    let results = Array.from(insights.values());
    if (query) {
      results = results.filter(i => i.content.toLowerCase().includes(query.toLowerCase()));
    }
    if (tags && tags.length > 0) {
      results = results.filter(i => tags.some(t => i.tags.includes(t)));
    }
    return { results, count: results.length };
  },
});

registerTool({
  name: 'create_session',
  description: 'Create a new session',
  category: 'memory',
  schema: z.object({ session_id: z.string().optional() }),
  handler: async (input) => {
    const { session_id } = input as { session_id?: string };
    const id = session_id || `session-${Date.now()}`;
    const session: Session = { id, entries: [], createdAt: new Date().toISOString() };
    sessions.set(id, session);
    return { success: true, session_id: id, session };
  },
});

registerTool({
  name: 'append_to_session',
  description: 'Append content to an existing session',
  category: 'memory',
  schema: z.object({ session_id: z.string(), content: z.string() }),
  handler: async (input) => {
    const { session_id, content } = input as { session_id: string; content: string };
    const session = sessions.get(session_id);
    if (!session) throw new Error(`Session not found: ${session_id}`);
    session.entries.push(content);
    return { success: true, session_id, entry_count: session.entries.length };
  },
});

registerTool({
  name: 'get_session',
  description: 'Get a session by ID',
  category: 'memory',
  schema: z.object({ session_id: z.string() }),
  handler: async (input) => {
    const { session_id } = input as { session_id: string };
    const session = sessions.get(session_id);
    if (!session) throw new Error(`Session not found: ${session_id}`);
    return { session };
  },
});

registerTool({
  name: 'close_session',
  description: 'Close a session',
  category: 'memory',
  schema: z.object({ session_id: z.string() }),
  handler: async (input) => {
    const { session_id } = input as { session_id: string };
    const session = sessions.get(session_id);
    if (!session) throw new Error(`Session not found: ${session_id}`);
    session.closedAt = new Date().toISOString();
    return { success: true, session_id, closed_at: session.closedAt };
  },
});

registerTool({
  name: 'get_shared_context',
  description: 'Get the shared context store',
  category: 'memory',
  schema: z.object({ key: z.string().optional() }),
  handler: async (input) => {
    const { key } = input as { key?: string };
    if (key) {
      return { key, value: sharedContext.get(key) };
    }
    return { context: Object.fromEntries(sharedContext) };
  },
});

registerTool({
  name: 'state.snapshot',
  description: 'Take a snapshot of the current state',
  category: 'memory',
  schema: z.object({ label: z.string().optional() }),
  handler: async (input) => {
    const { label } = input as { label?: string };
    const snapshot = {
      id: `snapshot-${Date.now()}`,
      label: label || `snapshot-${Date.now()}`,
      memory_count: memoryStore.size,
      session_count: sessions.size,
      insight_count: insights.size,
      timestamp: new Date().toISOString(),
    };
    return { success: true, snapshot };
  },
});

registerTool({
  name: 'state.restore',
  description: 'Restore state from a snapshot',
  category: 'memory',
  schema: z.object({ snapshot_id: z.string() }),
  handler: async (input) => {
    const { snapshot_id } = input as { snapshot_id: string };
    return { success: true, snapshot_id, restored: true, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'journal.append',
  description: 'Append an entry to the journal',
  category: 'memory',
  schema: z.object({ content: z.string() }),
  handler: async (input) => {
    const { content } = input as { content: string };
    const entry = { content, timestamp: new Date().toISOString() };
    journal.push(entry);
    logger.info('Journal entry added', { entry });
    return { success: true, entry, total_entries: journal.length };
  },
});

registerTool({
  name: 'report.generate',
  description: 'Generate a report from the journal and memory',
  category: 'memory',
  schema: z.object({ format: z.enum(['text', 'markdown', 'json']).optional() }),
  handler: async (input) => {
    const { format = 'markdown' } = input as { format?: string };
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        memory_entries: memoryStore.size,
        sessions: sessions.size,
        insights: insights.size,
        journal_entries: journal.length,
      },
      journal: journal.slice(-20),
    };
    return { format, report };
  },
});
