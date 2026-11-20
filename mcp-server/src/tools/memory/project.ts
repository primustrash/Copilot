import { z } from 'zod';
import { registerTool } from '../../registry';

// Project and user memory stores
const projectMemory = new Map<string, unknown>();
const userPreferences = new Map<string, unknown>();
const solutionPatterns: Array<{ pattern: string; solution: string; context: string; createdAt: string }> = [];
const errorPatterns: Array<{ error: string; fix: string; context: string; createdAt: string }> = [];

registerTool({
  name: 'memory.read_project_memory',
  description: 'Read project memory',
  category: 'memory',
  schema: z.object({ key: z.string().optional() }),
  handler: async (input) => {
    const { key } = input as { key?: string };
    if (key) {
      return { key, value: projectMemory.get(key) ?? null };
    }
    return { memory: Object.fromEntries(projectMemory) };
  },
});

registerTool({
  name: 'memory.write_project_memory',
  description: 'Write to project memory',
  category: 'memory',
  schema: z.object({ key: z.string(), value: z.unknown() }),
  handler: async (input) => {
    const { key, value } = input as { key: string; value: unknown };
    projectMemory.set(key, value);
    return { success: true, key };
  },
});

registerTool({
  name: 'memory.update_project_memory',
  description: 'Update project memory',
  category: 'memory',
  schema: z.object({ key: z.string(), value: z.unknown() }),
  handler: async (input) => {
    const { key, value } = input as { key: string; value: unknown };
    const existing = projectMemory.get(key);
    const updated = typeof existing === 'object' && typeof value === 'object'
      ? { ...existing as object, ...value as object }
      : value;
    projectMemory.set(key, updated);
    return { success: true, key, updated };
  },
});

registerTool({
  name: 'memory.read_user_preferences',
  description: 'Read user preferences',
  category: 'memory',
  schema: z.object({ key: z.string().optional() }),
  handler: async (input) => {
    const { key } = input as { key?: string };
    if (key) {
      return { key, value: userPreferences.get(key) ?? null };
    }
    return { preferences: Object.fromEntries(userPreferences) };
  },
});

registerTool({
  name: 'memory.write_user_preferences',
  description: 'Write user preferences',
  category: 'memory',
  schema: z.object({ key: z.string(), value: z.unknown() }),
  handler: async (input) => {
    const { key, value } = input as { key: string; value: unknown };
    userPreferences.set(key, value);
    return { success: true, key };
  },
});

registerTool({
  name: 'memory.retrieve_relevant_context',
  description: 'Retrieve context relevant to a query',
  category: 'memory',
  schema: z.object({ query: z.string(), limit: z.number().optional() }),
  handler: async (input) => {
    const { query, limit = 5 } = input as { query: string; limit?: number };
    // Simple keyword search across all memory
    const results: Array<{ source: string; key: string; value: unknown; relevance: number }> = [];
    for (const [key, value] of projectMemory.entries()) {
      const str = JSON.stringify(value).toLowerCase();
      if (str.includes(query.toLowerCase())) {
        results.push({ source: 'project', key, value, relevance: 0.8 });
      }
    }
    return { query, results: results.slice(0, limit), count: results.length };
  },
});

registerTool({
  name: 'memory.store_solution_pattern',
  description: 'Store a solution pattern for future reuse',
  category: 'memory',
  schema: z.object({ pattern: z.string(), solution: z.string(), context: z.string().optional() }),
  handler: async (input) => {
    const { pattern, solution, context = '' } = input as { pattern: string; solution: string; context?: string };
    solutionPatterns.push({ pattern, solution, context, createdAt: new Date().toISOString() });
    return { success: true, pattern, total_patterns: solutionPatterns.length };
  },
});

registerTool({
  name: 'memory.store_error_pattern',
  description: 'Store an error pattern and its fix',
  category: 'memory',
  schema: z.object({ error: z.string(), fix: z.string(), context: z.string().optional() }),
  handler: async (input) => {
    const { error, fix, context = '' } = input as { error: string; fix: string; context?: string };
    errorPatterns.push({ error, fix, context, createdAt: new Date().toISOString() });
    return { success: true, error, total_patterns: errorPatterns.length };
  },
});
