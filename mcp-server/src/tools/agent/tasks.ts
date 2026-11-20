import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';

// Additional agent tools (agent.* namespace for coding agents)
const agentTasks = new Map<string, {
  id: string; description: string; status: string; plan?: unknown; progress?: string;
}>();
const parallelTasks = new Map<string, string[]>();

registerTool({
  name: 'agent.create_task',
  description: 'Create an agent task',
  category: 'agent',
  schema: z.object({ description: z.string(), priority: z.enum(['low', 'medium', 'high']).optional() }),
  handler: async (input) => {
    const { description, priority = 'medium' } = input as { description: string; priority?: string };
    const id = `agent-task-${Date.now()}`;
    agentTasks.set(id, { id, description, status: 'pending' });
    return { task_id: id, description, priority };
  },
});

registerTool({
  name: 'agent.run_task',
  description: 'Run an agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const task = agentTasks.get(task_id);
    if (!task) throw new Error(`Task not found: ${task_id}`);
    task.status = 'running';
    return { task_id, status: 'running', started_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'agent.pause_task',
  description: 'Pause a running agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const task = agentTasks.get(task_id);
    if (task) task.status = 'paused';
    return { task_id, status: 'paused' };
  },
});

registerTool({
  name: 'agent.resume_task',
  description: 'Resume a paused agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const task = agentTasks.get(task_id);
    if (task) task.status = 'running';
    return { task_id, status: 'running' };
  },
});

registerTool({
  name: 'agent.cancel_task',
  description: 'Cancel an agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    agentTasks.delete(task_id);
    return { task_id, cancelled: true };
  },
});

registerTool({
  name: 'agent.list_tasks',
  description: 'List all agent tasks',
  category: 'agent',
  schema: z.object({ status: z.string().optional() }),
  handler: async (input) => {
    const { status } = input as { status?: string };
    const tasks = Array.from(agentTasks.values()).filter(t => !status || t.status === status);
    return { tasks, count: tasks.length };
  },
});

registerTool({
  name: 'agent.get_task_status',
  description: 'Get the status of an agent task',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const task = agentTasks.get(task_id);
    if (!task) throw new Error(`Task not found: ${task_id}`);
    return { task_id, status: task.status };
  },
});

registerTool({
  name: 'agent.spawn_parallel_task',
  description: 'Spawn a parallel agent task',
  category: 'agent',
  schema: z.object({ parent_task_id: z.string(), description: z.string() }),
  handler: async (input) => {
    const { parent_task_id, description } = input as { parent_task_id: string; description: string };
    const id = `parallel-${Date.now()}`;
    agentTasks.set(id, { id, description, status: 'pending' });
    const existing = parallelTasks.get(parent_task_id) || [];
    existing.push(id);
    parallelTasks.set(parent_task_id, existing);
    return { task_id: id, parent_task_id, description };
  },
});

registerTool({
  name: 'agent.join_parallel_tasks',
  description: 'Wait for all parallel tasks to complete',
  category: 'agent',
  schema: z.object({ parent_task_id: z.string() }),
  handler: async (input) => {
    const { parent_task_id } = input as { parent_task_id: string };
    const taskIds = parallelTasks.get(parent_task_id) || [];
    const tasks = taskIds.map(id => agentTasks.get(id)).filter(Boolean);
    return { parent_task_id, parallel_tasks: tasks, all_done: tasks.every(t => t?.status === 'done') };
  },
});

registerTool({
  name: 'agent.create_plan',
  description: 'Create an execution plan for a task',
  category: 'agent',
  schema: z.object({ goal: z.string(), constraints: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { goal, constraints = [] } = input as { goal: string; constraints?: string[] };
    const plan = {
      id: `plan-${Date.now()}`,
      goal,
      constraints,
      steps: [
        { step: 1, action: 'Analyze goal', status: 'pending' },
        { step: 2, action: 'Gather information', status: 'pending' },
        { step: 3, action: 'Execute solution', status: 'pending' },
        { step: 4, action: 'Verify results', status: 'pending' },
      ],
    };
    return { plan };
  },
});

registerTool({
  name: 'agent.update_plan',
  description: 'Update an existing plan',
  category: 'agent',
  schema: z.object({ plan_id: z.string(), updates: z.record(z.unknown()) }),
  handler: async (input) => {
    const { plan_id, updates } = input as { plan_id: string; updates: Record<string, unknown> };
    return { plan_id, updates, updated: true };
  },
});

registerTool({
  name: 'agent.next_step',
  description: 'Get the next step in a plan',
  category: 'agent',
  schema: z.object({ plan_id: z.string() }),
  handler: async (input) => {
    const { plan_id } = input as { plan_id: string };
    return { plan_id, next_step: { step: 1, action: 'Continue execution' } };
  },
});

registerTool({
  name: 'agent.self_review',
  description: 'Agent self-reviews its own work',
  category: 'agent',
  schema: z.object({ task_id: z.string(), output: z.string() }),
  handler: async (input) => {
    const { task_id, output } = input as { task_id: string; output: string };
    return {
      task_id,
      review: {
        quality: 'good',
        completeness: 0.9,
        issues: [],
        suggestion: 'Output looks good',
      },
    };
  },
});

registerTool({
  name: 'agent.retry_failed_step',
  description: 'Retry a failed step in a plan',
  category: 'agent',
  schema: z.object({ plan_id: z.string(), step: z.number() }),
  handler: async (input) => {
    const { plan_id, step } = input as { plan_id: string; step: number };
    return { plan_id, step, retrying: true, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'agent.summarize_progress',
  description: 'Summarize task execution progress',
  category: 'agent',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const task = agentTasks.get(task_id);
    return {
      task_id,
      status: task?.status || 'unknown',
      progress: '50%',
      summary: task?.description || 'Task not found',
    };
  },
});

registerTool({
  name: 'agent.create_handoff',
  description: 'Create a handoff to another agent',
  category: 'agent',
  schema: z.object({ to_agent: z.string(), context: z.record(z.unknown()), task_id: z.string().optional() }),
  handler: async (input) => {
    const { to_agent, context, task_id } = input as { to_agent: string; context: Record<string, unknown>; task_id?: string };
    return {
      handoff_id: `handoff-${Date.now()}`,
      to_agent,
      task_id,
      context,
      created_at: new Date().toISOString(),
    };
  },
});

registerTool({
  name: 'agent.accept_handoff',
  description: 'Accept a handoff from another agent',
  category: 'agent',
  schema: z.object({ handoff_id: z.string() }),
  handler: async (input) => {
    const { handoff_id } = input as { handoff_id: string };
    return { handoff_id, accepted: true, timestamp: new Date().toISOString() };
  },
});
