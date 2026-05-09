import { Request, Response } from 'express';
import { executeTool, getMCPToolList, listCategories, listTools } from './registry';
import { logger, logToolExecution } from './utils/logger';
import { config } from './utils/config';

let killSwitchActive = false;

export async function handleToolCall(req: Request, res: Response): Promise<void> {
  if (killSwitchActive) {
    res.status(503).json({ error: 'Kill switch active – server is in safe mode', code: 'KILL_SWITCH' });
    return;
  }

  const { tool, input } = req.body as { tool: string; input: unknown };

  if (!tool) {
    res.status(400).json({ error: 'Missing "tool" field in request body' });
    return;
  }

  const startTime = Date.now();

  try {
    logger.info('Tool call', { tool, input });
    const result = await executeTool(tool, input ?? {});
    const duration = Date.now() - startTime;

    logToolExecution(tool, input, result, duration);

    res.json({
      tool,
      result,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    const duration = Date.now() - startTime;
    logger.error('Tool execution failed', { tool, error: error.message });

    res.status(400).json({
      tool,
      error: error.message,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  }
}

export function handleToolsList(_req: Request, res: Response): void {
  const tools = getMCPToolList();
  res.json({ tools, count: tools.length });
}

export function handleCategoriesList(_req: Request, res: Response): void {
  const categories = listCategories();
  res.json({ categories });
}

export function handleCategoryTools(req: Request, res: Response): void {
  const { category } = req.params;
  const tools = listTools(category);
  res.json({ category, tools: tools.map(t => ({ name: t.name, description: t.description })) });
}

export function handleResourcesList(_req: Request, res: Response): void {
  res.json({
    resources: [
      { uri: 'mcp://tools', name: 'Tool Registry', description: 'All available MCP tools' },
      { uri: 'mcp://categories', name: 'Tool Categories', description: 'Tool categories' },
      { uri: 'mcp://health', name: 'Health Status', description: 'Server health information' },
    ],
  });
}

export function handlePromptsList(_req: Request, res: Response): void {
  res.json({
    prompts: [
      { name: 'code_review', description: 'Review code changes and provide feedback' },
      { name: 'explain_codebase', description: 'Explain the structure of a codebase' },
      { name: 'generate_tests', description: 'Generate unit tests for a given function' },
      { name: 'summarize_project', description: 'Summarize what a project does' },
    ],
  });
}

export function handlePromptsGet(req: Request, res: Response): void {
  const { name } = req.params;
  const prompts: Record<string, { description: string; template: string }> = {
    code_review: {
      description: 'Review code changes',
      template: 'Review the following code changes:\n{diff}\n\nProvide feedback on quality, security, and correctness.',
    },
    explain_codebase: {
      description: 'Explain codebase',
      template: 'Explain the structure and purpose of this codebase:\n{structure}',
    },
    generate_tests: {
      description: 'Generate tests',
      template: 'Generate comprehensive unit tests for:\n{code}',
    },
    summarize_project: {
      description: 'Summarize project',
      template: 'Summarize what this project does based on:\n{readme}\n\nFiles: {files}',
    },
  };

  const prompt = prompts[name];
  if (!prompt) {
    res.status(404).json({ error: `Prompt not found: ${name}` });
    return;
  }

  res.json({ name, ...prompt });
}

export function handleKillSwitch(req: Request, res: Response): void {
  const token = req.headers['x-kill-switch-token'] as string;
  const { action } = req.body as { action: 'enable' | 'disable' };

  if (!config.security.killSwitchToken) {
    res.status(503).json({ error: 'Kill switch token is not configured' });
    return;
  }

  if (token !== config.security.killSwitchToken) {
    res.status(403).json({ error: 'Invalid kill switch token' });
    return;
  }

  if (action === 'enable') {
    killSwitchActive = true;
    logger.warn('KILL SWITCH ACTIVATED');
    res.json({ status: 'kill_switch_active' });
  } else if (action === 'disable') {
    killSwitchActive = false;
    logger.info('Kill switch deactivated');
    res.json({ status: 'kill_switch_inactive' });
  } else {
    res.status(400).json({ error: 'Invalid action. Use "enable" or "disable"' });
  }
}

export function isKillSwitchActive(): boolean {
  return killSwitchActive;
}
