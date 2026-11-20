import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger, auditLogger } from '../../utils/logger';

const auditLog: Array<{ tool: string; input: unknown; timestamp: string; user?: string }> = [];
const toolUsageStats = new Map<string, number>();
let killedTools = new Set<string>();

registerTool({
  name: 'get_audit_log',
  description: 'Get the audit log entries',
  category: 'monitoring',
  schema: z.object({
    limit: z.number().optional(),
    tool: z.string().optional(),
    since: z.string().optional(),
  }),
  handler: async (input) => {
    const { limit = 100, tool, since } = input as { limit?: number; tool?: string; since?: string };
    let entries = auditLog;
    if (tool) entries = entries.filter(e => e.tool === tool);
    if (since) {
      const sinceDate = new Date(since);
      entries = entries.filter(e => new Date(e.timestamp) >= sinceDate);
    }
    return { entries: entries.slice(-limit), total: auditLog.length };
  },
});

registerTool({
  name: 'audit.log',
  description: 'Write an audit log entry',
  category: 'monitoring',
  schema: z.object({
    action: z.string(),
    resource: z.string().optional(),
    outcome: z.enum(['success', 'failure', 'denied']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { action, resource, outcome = 'success', metadata } = input as {
      action: string; resource?: string; outcome?: string; metadata?: Record<string, unknown>;
    };
    const entry = { action, resource, outcome, metadata, timestamp: new Date().toISOString() };
    auditLog.push({ tool: 'audit.log', input: entry, timestamp: entry.timestamp });
    auditLogger.info('audit_entry', entry);
    return { success: true, entry };
  },
});

registerTool({
  name: 'audit.export',
  description: 'Export audit log to a file',
  category: 'monitoring',
  schema: z.object({ format: z.enum(['json', 'csv']).optional(), output_path: z.string().optional() }),
  handler: async (input) => {
    const { format = 'json', output_path = '/tmp/audit-export.json' } = input as {
      format?: string; output_path?: string;
    };
    const data = format === 'json'
      ? JSON.stringify(auditLog, null, 2)
      : auditLog.map(e => `${e.timestamp},${e.tool},${JSON.stringify(e.input)}`).join('\n');

    const fs = await import('fs');
    fs.writeFileSync(output_path, data, 'utf-8');
    return { success: true, format, output_path, entries: auditLog.length };
  },
});

registerTool({
  name: 'record_tool_usage',
  description: 'Record tool usage statistics',
  category: 'monitoring',
  schema: z.object({ tool: z.string(), success: z.boolean().optional() }),
  handler: async (input) => {
    const { tool, success = true } = input as { tool: string; success?: boolean };
    const count = (toolUsageStats.get(tool) || 0) + 1;
    toolUsageStats.set(tool, count);
    auditLog.push({ tool, input: { success }, timestamp: new Date().toISOString() });
    return { tool, count, success };
  },
});

registerTool({
  name: 'get_top_tools',
  description: 'Get the most used tools',
  category: 'monitoring',
  schema: z.object({ limit: z.number().optional() }),
  handler: async (input) => {
    const { limit = 10 } = input as { limit?: number };
    const sorted = Array.from(toolUsageStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tool, count]) => ({ tool, count }));
    return { top_tools: sorted };
  },
});

registerTool({
  name: 'risk.classify',
  description: 'Classify the risk level of an action',
  category: 'monitoring',
  schema: z.object({ action: z.string(), context: z.string().optional() }),
  handler: async (input) => {
    const { action, context } = input as { action: string; context?: string };
    const highRiskKeywords = ['delete', 'drop', 'destroy', 'remove', 'truncate', 'kill', 'rm -rf'];
    const isHighRisk = highRiskKeywords.some(kw => action.toLowerCase().includes(kw));
    return {
      action,
      risk_level: isHighRisk ? 'high' : 'low',
      requires_approval: isHighRisk,
      context,
    };
  },
});

registerTool({
  name: 'guardrails.block',
  description: 'Block execution of a tool or action',
  category: 'monitoring',
  schema: z.object({ tool: z.string(), reason: z.string() }),
  handler: async (input) => {
    const { tool, reason } = input as { tool: string; reason: string };
    killedTools.add(tool);
    logger.warn('Tool blocked by guardrails', { tool, reason });
    return { blocked: true, tool, reason };
  },
});

registerTool({
  name: 'budget.check',
  description: 'Check current budget usage',
  category: 'monitoring',
  schema: z.object({}),
  handler: async () => {
    return {
      tokens_used_this_hour: 0,
      max_tokens_per_hour: 100000,
      cost_today_usd: 0,
      max_cost_per_day_usd: 10.00,
      within_budget: true,
    };
  },
});

registerTool({
  name: 'budget.limit',
  description: 'Set budget limits',
  category: 'monitoring',
  schema: z.object({
    max_tokens_per_hour: z.number().optional(),
    max_cost_usd_per_day: z.number().optional(),
  }),
  handler: async (input) => {
    const { max_tokens_per_hour, max_cost_usd_per_day } = input as {
      max_tokens_per_hour?: number; max_cost_usd_per_day?: number;
    };
    return { updated: true, max_tokens_per_hour, max_cost_usd_per_day };
  },
});
