import { z } from 'zod';
import { registerTool, executeTool } from '../../registry';
import { logger } from '../../utils/logger';

const toolCallSchema = z.object({
  tool: z.string(),
  input: z.unknown().optional(),
  id: z.string().optional(),
});

registerTool({
  name: 'batch.run_sequence',
  description: 'Run multiple tool calls in sequence. Each call receives the result of the previous as `previous_result`.',
  category: 'batch',
  schema: z.object({
    calls: z.array(toolCallSchema),
    stop_on_error: z.boolean().optional(),
    pass_results: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { calls, stop_on_error = true, pass_results = false } = input as {
      calls: Array<{ tool: string; input?: unknown; id?: string }>;
      stop_on_error?: boolean;
      pass_results?: boolean;
    };

    const results: Array<{
      id?: string; tool: string; result?: unknown; error?: string;
      duration_ms: number; success: boolean;
    }> = [];
    let previousResult: unknown = null;

    for (const call of calls) {
      const start = Date.now();
      const callInput = pass_results
        ? { ...(call.input as object || {}), previous_result: previousResult }
        : (call.input ?? {});

      try {
        const result = await executeTool(call.tool, callInput);
        const duration = Date.now() - start;
        results.push({ id: call.id, tool: call.tool, result, duration_ms: duration, success: true });
        previousResult = result;
        logger.info('batch.run_sequence step done', { tool: call.tool, duration });
      } catch (err) {
        const duration = Date.now() - start;
        const error = (err as Error).message;
        results.push({ id: call.id, tool: call.tool, error, duration_ms: duration, success: false });
        logger.warn('batch.run_sequence step failed', { tool: call.tool, error });
        if (stop_on_error) {
          return {
            results,
            completed: results.length,
            total: calls.length,
            stopped_early: true,
            stop_reason: `Error in tool '${call.tool}': ${error}`,
          };
        }
      }
    }

    const succeeded = results.filter(r => r.success).length;
    return {
      results,
      completed: results.length,
      total: calls.length,
      succeeded,
      failed: results.length - succeeded,
      stopped_early: false,
    };
  },
});

registerTool({
  name: 'batch.run_parallel',
  description: 'Run multiple tool calls concurrently and collect all results',
  category: 'batch',
  schema: z.object({
    calls: z.array(toolCallSchema),
    max_concurrency: z.number().optional(),
    timeout_ms: z.number().optional(),
  }),
  handler: async (input) => {
    const { calls, max_concurrency = 10, timeout_ms = 60000 } = input as {
      calls: Array<{ tool: string; input?: unknown; id?: string }>;
      max_concurrency?: number;
      timeout_ms?: number;
    };

    async function runWithTimeout(call: { tool: string; input?: unknown; id?: string }) {
      const start = Date.now();
      const withTimeout = new Promise<unknown>((resolve, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeout_ms}ms`)), timeout_ms);
        executeTool(call.tool, call.input ?? {}).then(resolve).catch(reject);
      });
      try {
        const result = await withTimeout;
        return { id: call.id, tool: call.tool, result, duration_ms: Date.now() - start, success: true };
      } catch (err) {
        return {
          id: call.id,
          tool: call.tool,
          error: (err as Error).message,
          duration_ms: Date.now() - start,
          success: false,
        };
      }
    }

    // Chunk into batches respecting max_concurrency
    const results: Array<{ id?: string; tool: string; result?: unknown; error?: string; duration_ms: number; success: boolean }> = [];
    for (let i = 0; i < calls.length; i += max_concurrency) {
      const chunk = calls.slice(i, i + max_concurrency);
      const chunkResults = await Promise.all(chunk.map(runWithTimeout));
      results.push(...chunkResults);
    }

    const succeeded = results.filter(r => r.success).length;
    return {
      results,
      total: calls.length,
      succeeded,
      failed: results.length - succeeded,
    };
  },
});

registerTool({
  name: 'batch.map',
  description: 'Apply a single tool to a list of inputs',
  category: 'batch',
  schema: z.object({
    tool: z.string(),
    inputs: z.array(z.unknown()),
    parallel: z.boolean().optional(),
    stop_on_error: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { tool, inputs, parallel = true, stop_on_error = false } = input as {
      tool: string; inputs: unknown[]; parallel?: boolean; stop_on_error?: boolean;
    };

    if (parallel) {
      const results = await Promise.all(inputs.map(async (inp, idx) => {
        const start = Date.now();
        try {
          const result = await executeTool(tool, inp ?? {});
          return { index: idx, result, duration_ms: Date.now() - start, success: true };
        } catch (err) {
          return { index: idx, error: (err as Error).message, duration_ms: Date.now() - start, success: false };
        }
      }));
      const succeeded = results.filter(r => r.success).length;
      return { tool, results, total: inputs.length, succeeded, failed: results.length - succeeded };
    }

    // Sequential
    const results: Array<{ index: number; result?: unknown; error?: string; duration_ms: number; success: boolean }> = [];
    for (let idx = 0; idx < inputs.length; idx++) {
      const start = Date.now();
      try {
        const result = await executeTool(tool, inputs[idx] ?? {});
        results.push({ index: idx, result, duration_ms: Date.now() - start, success: true });
      } catch (err) {
        const error = (err as Error).message;
        results.push({ index: idx, error, duration_ms: Date.now() - start, success: false });
        if (stop_on_error) {
          return { tool, results, stopped_at: idx, stop_reason: error };
        }
      }
    }

    const succeeded = results.filter(r => r.success).length;
    return { tool, results, total: inputs.length, succeeded, failed: results.length - succeeded };
  },
});

registerTool({
  name: 'batch.pipeline',
  description: 'Chain tools where each output is passed as input to the next',
  category: 'batch',
  schema: z.object({
    tools: z.array(z.string()),
    initial_input: z.unknown().optional(),
    result_key: z.string().optional(),
  }),
  handler: async (input) => {
    const { tools, initial_input, result_key = 'result' } = input as {
      tools: string[]; initial_input?: unknown; result_key?: string;
    };

    const steps: Array<{ tool: string; input: unknown; output: unknown; duration_ms: number }> = [];
    let current: unknown = initial_input ?? {};

    for (const tool of tools) {
      const start = Date.now();
      const toolInput = typeof current === 'object' && current !== null
        ? current
        : { [result_key]: current };

      const output = await executeTool(tool, toolInput);
      steps.push({ tool, input: toolInput, output, duration_ms: Date.now() - start });
      current = output;
    }

    return { final_result: current, steps, tools_executed: tools.length };
  },
});
