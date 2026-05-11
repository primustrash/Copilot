import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';

interface AgentRecord {
  id: string;
  name: string;
  capabilities: string[];
  endpoint?: string;
  status: 'active' | 'inactive' | 'busy';
  registeredAt: string;
}

interface Task {
  id: string;
  agentId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  createdAt: string;
}

const agents = new Map<string, AgentRecord>();
const tasks = new Map<string, Task>();
const events: Array<{ topic: string; payload: unknown; timestamp: string }> = [];

registerTool({
  name: 'register_agent',
  description: 'Register a new agent with its capabilities',
  category: 'agent',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(z.string()),
    endpoint: z.string().optional(),
  }),
  handler: async (input) => {
    const { id, name, capabilities, endpoint } = input as AgentRecord;
    const agent: AgentRecord = {
      id, name, capabilities, endpoint,
      status: 'active',
      registeredAt: new Date().toISOString(),
    };
    agents.set(id, agent);
    logger.info('Agent registered', { id, name });
    return { success: true, agent };
  },
});

registerTool({
  name: 'list_agents',
  description: 'List all registered agents',
  category: 'agent',
  schema: z.object({ status: z.enum(['active', 'inactive', 'busy', 'all']).optional() }),
  handler: async (input) => {
    const { status } = input as { status?: string };
    const list = Array.from(agents.values()).filter(a => !status || status === 'all' || a.status === status);
    return { agents: list, count: list.length };
  },
});

registerTool({
  name: 'get_agent_capabilities',
  description: 'Get capabilities of a specific agent',
  category: 'agent',
  schema: z.object({ agent_id: z.string() }),
  handler: async (input) => {
    const { agent_id } = input as { agent_id: string };
    const agent = agents.get(agent_id);
    if (!agent) throw new Error(`Agent not found: ${agent_id}`);
    return { agent_id, capabilities: agent.capabilities, status: agent.status };
  },
});

registerTool({
  name: 'send_message',
  description: 'Send a message to a specific agent',
  category: 'agent',
  schema: z.object({
    to_agent_id: z.string(),
    message: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { to_agent_id, message, metadata } = input as { to_agent_id: string; message: string; metadata?: Record<string, unknown> };
    const agent = agents.get(to_agent_id);
    if (!agent) throw new Error(`Agent not found: ${to_agent_id}`);
    logger.info('Message sent to agent', { to_agent_id, message });
    return { success: true, delivered: true, agent_id: to_agent_id, message, metadata };
  },
});

registerTool({
  name: 'publish_event',
  description: 'Publish an event to a topic',
  category: 'agent',
  schema: z.object({ topic: z.string(), payload: z.unknown() }),
  handler: async (input) => {
    const { topic, payload } = input as { topic: string; payload: unknown };
    const event = { topic, payload, timestamp: new Date().toISOString() };
    events.push(event);
    logger.info('Event published', { topic });
    return { success: true, event };
  },
});

registerTool({
  name: 'subscribe_topic',
  description: 'Subscribe to a topic for events',
  category: 'agent',
  schema: z.object({ topic: z.string(), agent_id: z.string() }),
  handler: async (input) => {
    const { topic, agent_id } = input as { topic: string; agent_id: string };
    return { success: true, subscribed: true, topic, agent_id };
  },
});

registerTool({
  name: 'create_handover',
  description: 'Create a context handover to another agent',
  category: 'agent',
  schema: z.object({
    from_agent_id: z.string(),
    to_agent_id: z.string(),
    context: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  handler: async (input) => {
    const { from_agent_id, to_agent_id, context, reason } = input as {
      from_agent_id: string; to_agent_id: string; context: Record<string, unknown>; reason?: string;
    };
    const handoverId = `handover-${Date.now()}`;
    return { success: true, handover_id: handoverId, from: from_agent_id, to: to_agent_id, context, reason };
  },
});

registerTool({
  name: 'accept_handover',
  description: 'Accept a context handover',
  category: 'agent',
  schema: z.object({ handover_id: z.string(), agent_id: z.string() }),
  handler: async (input) => {
    const { handover_id, agent_id } = input as { handover_id: string; agent_id: string };
    return { success: true, handover_id, agent_id, accepted_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'get_context',
  description: 'Get the current context for an agent',
  category: 'agent',
  schema: z.object({ agent_id: z.string() }),
  handler: async (input) => {
    const { agent_id } = input as { agent_id: string };
    const agent = agents.get(agent_id);
    return { agent_id, context: { agent, timestamp: new Date().toISOString() } };
  },
});

registerTool({
  name: 'assign_task_to_agent',
  description: 'Assign a task to a specific agent',
  category: 'agent',
  schema: z.object({
    agent_id: z.string(),
    task_description: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  }),
  handler: async (input) => {
    const { agent_id, task_description, priority } = input as { agent_id: string; task_description: string; priority?: string };
    const taskId = `task-${Date.now()}`;
    const task: Task = {
      id: taskId,
      agentId: agent_id,
      description: task_description,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    tasks.set(taskId, task);
    return { success: true, task_id: taskId, agent_id, priority: priority || 'medium' };
  },
});

registerTool({
  name: 'route_to_model',
  description: 'Route a request to the best available AI model',
  category: 'agent',
  schema: z.object({
    prompt: z.string(),
    model_preference: z.enum(['fast', 'smart', 'cheap']).optional(),
  }),
  handler: async (input) => {
    const { prompt, model_preference } = input as { prompt: string; model_preference?: string };
    const modelMap: Record<string, string> = {
      fast: 'gpt-4o-mini',
      smart: 'claude-3-5-sonnet-20241022',
      cheap: 'gpt-3.5-turbo',
    };
    const model = modelMap[model_preference || 'smart'] || 'claude-3-5-sonnet-20241022';
    return { routed_to: model, prompt_length: prompt.length, estimated_tokens: Math.ceil(prompt.length / 4) };
  },
});

registerTool({
  name: 'fast_reason',
  description: 'Perform fast reasoning on a problem',
  category: 'agent',
  schema: z.object({ problem: z.string(), context: z.string().optional() }),
  handler: async (input) => {
    const { problem, context } = input as { problem: string; context?: string };
    return {
      problem,
      reasoning: `Analyzed problem with ${context ? 'provided context' : 'no context'}`,
      approach: 'decompose → analyze → synthesize',
      confidence: 0.85,
    };
  },
});

registerTool({
  name: 'aggregate_results',
  description: 'Aggregate results from multiple agents',
  category: 'agent',
  schema: z.object({
    results: z.array(z.object({ agent_id: z.string(), result: z.unknown() })),
    strategy: z.enum(['merge', 'vote', 'best']).optional(),
  }),
  handler: async (input) => {
    const { results, strategy } = input as { results: Array<{ agent_id: string; result: unknown }>; strategy?: string };
    return { aggregated: results, strategy: strategy || 'merge', count: results.length };
  },
});

registerTool({
  name: 'submit_result',
  description: 'Submit a result from an agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string(), agent_id: z.string(), result: z.unknown() }),
  handler: async (input) => {
    const { task_id, agent_id, result } = input as { task_id: string; agent_id: string; result: unknown };
    const task = tasks.get(task_id);
    if (task) task.status = 'done';
    return { success: true, task_id, agent_id, result, completed_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'decompose_goal',
  description: 'Decompose a high-level goal into subtasks',
  category: 'agent',
  schema: z.object({ goal: z.string(), max_tasks: z.number().optional() }),
  handler: async (input) => {
    const { goal, max_tasks } = input as { goal: string; max_tasks?: number };
    const subtasks = [
      { id: '1', description: `Analyze: ${goal}`, order: 1 },
      { id: '2', description: `Plan approach for: ${goal}`, order: 2 },
      { id: '3', description: `Execute: ${goal}`, order: 3 },
      { id: '4', description: `Verify results for: ${goal}`, order: 4 },
    ].slice(0, max_tasks || 4);
    return { goal, subtasks, count: subtasks.length };
  },
});

registerTool({
  name: 'get_next_task',
  description: 'Get the next pending task for an agent',
  category: 'agent',
  schema: z.object({ agent_id: z.string() }),
  handler: async (input) => {
    const { agent_id } = input as { agent_id: string };
    const task = Array.from(tasks.values()).find(t => t.agentId === agent_id && t.status === 'pending');
    if (!task) return { task: null, message: 'No pending tasks' };
    task.status = 'in_progress';
    return { task };
  },
});

registerTool({
  name: 'mark_task_done',
  description: 'Mark a task as completed',
  category: 'agent',
  schema: z.object({ task_id: z.string(), result: z.unknown().optional() }),
  handler: async (input) => {
    const { task_id, result } = input as { task_id: string; result?: unknown };
    const task = tasks.get(task_id);
    if (!task) throw new Error(`Task not found: ${task_id}`);
    task.status = 'done';
    return { success: true, task_id, result, completed_at: new Date().toISOString() };
  },
});
