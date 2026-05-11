import { z } from 'zod';
import { registerTool } from '../../registry';
import { getMCPToolList, listCategories, listTools } from '../../registry';

registerTool({
  name: 'tools/list',
  description: 'List all available MCP tools',
  category: 'infra',
  schema: z.object({ category: z.string().optional() }),
  handler: async (input) => {
    const { category } = input as { category?: string };
    const tools = category ? listTools(category) : getMCPToolList();
    return { tools, count: Array.isArray(tools) ? tools.length : 0 };
  },
});

registerTool({
  name: 'resources/list',
  description: 'List all available MCP resources',
  category: 'infra',
  schema: z.object({}),
  handler: async () => {
    return {
      resources: [
        { uri: 'mcp://tools', name: 'Tools', mimeType: 'application/json' },
        { uri: 'mcp://health', name: 'Health', mimeType: 'application/json' },
        { uri: 'mcp://logs', name: 'Logs', mimeType: 'text/plain' },
      ],
    };
  },
});

registerTool({
  name: 'prompts/list',
  description: 'List all available MCP prompts',
  category: 'infra',
  schema: z.object({}),
  handler: async () => {
    return {
      prompts: [
        { name: 'code_review', description: 'Review code changes' },
        { name: 'explain_codebase', description: 'Explain codebase structure' },
        { name: 'generate_tests', description: 'Generate unit tests' },
        { name: 'security_audit', description: 'Audit code for security issues' },
      ],
    };
  },
});

registerTool({
  name: 'prompts/get',
  description: 'Get a specific MCP prompt',
  category: 'infra',
  schema: z.object({ name: z.string() }),
  handler: async (input) => {
    const { name } = input as { name: string };
    const prompts: Record<string, { description: string; template: string }> = {
      code_review: {
        description: 'Review code changes',
        template: 'Please review the following code:\n\n{code}\n\nFocus on: {aspects}',
      },
      explain_codebase: {
        description: 'Explain codebase',
        template: 'Explain this codebase structure:\n\n{structure}',
      },
    };
    const prompt = prompts[name];
    if (!prompt) throw new Error(`Prompt not found: ${name}`);
    return { name, ...prompt };
  },
});

registerTool({
  name: 'list_resources',
  description: 'List available resources',
  category: 'infra',
  schema: z.object({}),
  handler: async () => {
    return {
      resources: [
        { type: 'tool_registry', count: 0, uri: '/tools' },
        { type: 'memory_store', count: 0, uri: '/memory' },
      ],
    };
  },
});

registerTool({
  name: 'run_prompt',
  description: 'Run a named prompt',
  category: 'infra',
  schema: z.object({ name: z.string(), variables: z.record(z.string()).optional() }),
  handler: async (input) => {
    const { name, variables = {} } = input as { name: string; variables?: Record<string, string> };
    return { name, variables, executed: true, timestamp: new Date().toISOString() };
  },
});
