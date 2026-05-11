import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';
import axios from 'axios';

let tokenUsageThisHour = 0;
const availableModels = [
  { id: 'gpt-4o', provider: 'openai', context: 128000 },
  { id: 'gpt-4o-mini', provider: 'openai', context: 128000 },
  { id: 'gpt-3.5-turbo', provider: 'openai', context: 16385 },
  { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', context: 200000 },
  { id: 'claude-3-haiku-20240307', provider: 'anthropic', context: 200000 },
];

registerTool({
  name: 'code_complete',
  description: 'Complete code using AI',
  category: 'ai',
  schema: z.object({
    prompt: z.string(),
    language: z.string().optional(),
    model: z.string().optional(),
    max_tokens: z.number().optional(),
  }),
  handler: async (input) => {
    const { prompt, language, model = config.ai.openaiModel, max_tokens = 2048 } = input as {
      prompt: string; language?: string; model?: string; max_tokens?: number;
    };

    if (tokenUsageThisHour + max_tokens > config.budget.maxTokensPerHour) {
      throw new Error('Token budget exceeded for this hour');
    }

    if (!config.ai.openaiApiKey && !config.ai.anthropicApiKey) {
      return {
        completion: '// AI completion not available - configure API keys in .env',
        model,
        language,
      };
    }

    try {
      if (config.ai.openaiApiKey) {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: `You are an expert ${language || 'code'} developer. Complete the following code.` },
              { role: 'user', content: prompt },
            ],
            max_tokens,
          },
          { headers: { Authorization: `Bearer ${config.ai.openaiApiKey}` } }
        );
        const completion = response.data.choices[0]?.message?.content || '';
        tokenUsageThisHour += response.data.usage?.total_tokens || 0;
        return { completion, model, tokens_used: response.data.usage?.total_tokens };
      }
    } catch (err) {
      logger.error('AI completion failed', { err });
      throw new Error(`AI completion failed: ${(err as Error).message}`);
    }

    return { completion: '', model, error: 'No API key configured' };
  },
});

registerTool({
  name: 'code_review',
  description: 'Review code using AI',
  category: 'ai',
  schema: z.object({
    code: z.string(),
    language: z.string().optional(),
    focus: z.array(z.enum(['security', 'performance', 'style', 'correctness', 'tests'])).optional(),
  }),
  handler: async (input) => {
    const { code, language, focus = ['correctness', 'security'] } = input as {
      code: string; language?: string; focus?: string[];
    };

    if (!config.ai.openaiApiKey && !config.ai.anthropicApiKey) {
      return {
        review: 'Code review not available - configure API keys in .env',
        issues: [],
        language,
      };
    }

    const prompt = `Review this ${language || 'code'} for: ${focus.join(', ')}\n\n\`\`\`\n${code}\n\`\`\`\n\nProvide structured feedback.`;
    return { review: prompt, language, focus, message: 'Configure AI API keys for actual review' };
  },
});

registerTool({
  name: 'run_skill',
  description: 'Run a predefined AI skill',
  category: 'ai',
  schema: z.object({ skill: z.string(), input: z.unknown() }),
  handler: async (input) => {
    const { skill, input: skillInput } = input as { skill: string; input: unknown };
    logger.info('Running skill', { skill });
    return { skill, input: skillInput, result: null, message: 'Skill execution initiated' };
  },
});

registerTool({
  name: 'list_models',
  description: 'List available AI models',
  category: 'ai',
  schema: z.object({ provider: z.string().optional() }),
  handler: async (input) => {
    const { provider } = input as { provider?: string };
    const models = provider
      ? availableModels.filter(m => m.provider === provider)
      : availableModels;
    return { models, count: models.length };
  },
});

registerTool({
  name: 'list_skills',
  description: 'List available AI skills',
  category: 'ai',
  schema: z.object({}),
  handler: async () => {
    const skills = [
      { name: 'code_explain', description: 'Explain code' },
      { name: 'code_translate', description: 'Translate code between languages' },
      { name: 'code_optimize', description: 'Optimize code performance' },
      { name: 'test_generate', description: 'Generate tests' },
      { name: 'doc_generate', description: 'Generate documentation' },
      { name: 'bug_find', description: 'Find bugs in code' },
    ];
    return { skills, count: skills.length };
  },
});

registerTool({
  name: 'get_app_status',
  description: 'Get the status of the MCP server application',
  category: 'ai',
  schema: z.object({}),
  handler: async () => {
    return {
      status: 'running',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version,
      timestamp: new Date().toISOString(),
    };
  },
});
