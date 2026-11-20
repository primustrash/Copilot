import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';

interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  tasks: string[];
  createdAt: string;
  updatedAt: string;
}

interface ApprovalRequest {
  id: string;
  task_id: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
}

const goals = new Map<string, Goal>();
const approvals = new Map<string, ApprovalRequest>();
const schedule = new Map<string, { task: string; runAt: string; recurrence?: string }>();

registerTool({
  name: 'create_goal',
  description: 'Create a new goal',
  category: 'workflow',
  schema: z.object({ title: z.string(), description: z.string() }),
  handler: async (input) => {
    const { title, description } = input as { title: string; description: string };
    const id = `goal-${Date.now()}`;
    const goal: Goal = {
      id, title, description,
      status: 'active',
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    goals.set(id, goal);
    logger.info('Goal created', { id, title });
    return { success: true, goal };
  },
});

registerTool({
  name: 'get_goal',
  description: 'Get details of a specific goal',
  category: 'workflow',
  schema: z.object({ goal_id: z.string() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id: string };
    const goal = goals.get(goal_id);
    if (!goal) throw new Error(`Goal not found: ${goal_id}`);
    return { goal };
  },
});

registerTool({
  name: 'list_goals',
  description: 'List all goals',
  category: 'workflow',
  schema: z.object({ status: z.enum(['active', 'paused', 'completed', 'cancelled', 'all']).optional() }),
  handler: async (input) => {
    const { status } = input as { status?: string };
    const list = Array.from(goals.values()).filter(g => !status || status === 'all' || g.status === status);
    return { goals: list, count: list.length };
  },
});

registerTool({
  name: 'pause_goal',
  description: 'Pause an active goal',
  category: 'workflow',
  schema: z.object({ goal_id: z.string() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id: string };
    const goal = goals.get(goal_id);
    if (!goal) throw new Error(`Goal not found: ${goal_id}`);
    goal.status = 'paused';
    goal.updatedAt = new Date().toISOString();
    return { success: true, goal };
  },
});

registerTool({
  name: 'resume_goal',
  description: 'Resume a paused goal',
  category: 'workflow',
  schema: z.object({ goal_id: z.string() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id: string };
    const goal = goals.get(goal_id);
    if (!goal) throw new Error(`Goal not found: ${goal_id}`);
    goal.status = 'active';
    goal.updatedAt = new Date().toISOString();
    return { success: true, goal };
  },
});

registerTool({
  name: 'cancel_goal',
  description: 'Cancel a goal',
  category: 'workflow',
  schema: z.object({ goal_id: z.string(), reason: z.string().optional() }),
  handler: async (input) => {
    const { goal_id, reason } = input as { goal_id: string; reason?: string };
    const goal = goals.get(goal_id);
    if (!goal) throw new Error(`Goal not found: ${goal_id}`);
    goal.status = 'cancelled';
    goal.updatedAt = new Date().toISOString();
    return { success: true, goal, reason };
  },
});

registerTool({
  name: 'tick_goal',
  description: 'Advance a goal by one tick (run next action)',
  category: 'workflow',
  schema: z.object({ goal_id: z.string() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id: string };
    const goal = goals.get(goal_id);
    if (!goal) throw new Error(`Goal not found: ${goal_id}`);
    return {
      goal_id,
      ticked: true,
      next_action: 'Continue processing...',
      timestamp: new Date().toISOString(),
    };
  },
});

registerTool({
  name: 'request_approval',
  description: 'Request human approval for a task',
  category: 'workflow',
  schema: z.object({ task_id: z.string(), description: z.string() }),
  handler: async (input) => {
    const { task_id, description } = input as { task_id: string; description: string };
    const id = `approval-${Date.now()}`;
    const approval: ApprovalRequest = {
      id, task_id, description,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    approvals.set(id, approval);
    logger.info('Approval requested', { id, task_id });
    return { success: true, approval_id: id, approval };
  },
});

registerTool({
  name: 'get_pending_approvals',
  description: 'Get all pending approval requests',
  category: 'workflow',
  schema: z.object({}),
  handler: async () => {
    const pending = Array.from(approvals.values()).filter(a => a.status === 'pending');
    return { approvals: pending, count: pending.length };
  },
});

registerTool({
  name: 'approve_task',
  description: 'Approve a pending task',
  category: 'workflow',
  schema: z.object({ approval_id: z.string(), comment: z.string().optional() }),
  handler: async (input) => {
    const { approval_id, comment } = input as { approval_id: string; comment?: string };
    const approval = approvals.get(approval_id);
    if (!approval) throw new Error(`Approval not found: ${approval_id}`);
    approval.status = 'approved';
    approval.resolvedAt = new Date().toISOString();
    return { success: true, approval, comment };
  },
});

registerTool({
  name: 'reject_task',
  description: 'Reject a pending task',
  category: 'workflow',
  schema: z.object({ approval_id: z.string(), reason: z.string().optional() }),
  handler: async (input) => {
    const { approval_id, reason } = input as { approval_id: string; reason?: string };
    const approval = approvals.get(approval_id);
    if (!approval) throw new Error(`Approval not found: ${approval_id}`);
    approval.status = 'rejected';
    approval.resolvedAt = new Date().toISOString();
    return { success: true, approval, reason };
  },
});

// Planner tools
registerTool({
  name: 'planner.make_plan',
  description: 'Create a structured plan for a goal',
  category: 'workflow',
  schema: z.object({ goal: z.string(), constraints: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { goal, constraints } = input as { goal: string; constraints?: string[] };
    return {
      goal,
      plan: [
        { step: 1, action: 'Analyze requirements', status: 'pending' },
        { step: 2, action: 'Design solution', status: 'pending' },
        { step: 3, action: 'Implement', status: 'pending' },
        { step: 4, action: 'Test and verify', status: 'pending' },
      ],
      constraints: constraints || [],
      created_at: new Date().toISOString(),
    };
  },
});

registerTool({
  name: 'planner.next_action',
  description: 'Get the next action to take in a plan',
  category: 'workflow',
  schema: z.object({ plan_id: z.string() }),
  handler: async (input) => {
    const { plan_id } = input as { plan_id: string };
    return { plan_id, next_action: 'Continue with next step', step: 1 };
  },
});

registerTool({
  name: 'planner.replan',
  description: 'Replan based on new information',
  category: 'workflow',
  schema: z.object({ plan_id: z.string(), reason: z.string() }),
  handler: async (input) => {
    const { plan_id, reason } = input as { plan_id: string; reason: string };
    return { plan_id, replanned: true, reason, new_plan: [] };
  },
});

// Task tools
registerTool({
  name: 'task.create',
  description: 'Create a new task',
  category: 'workflow',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    goal_id: z.string().optional(),
  }),
  handler: async (input) => {
    const { title, description, priority, goal_id } = input as {
      title: string; description: string; priority?: string; goal_id?: string;
    };
    const taskId = `task-${Date.now()}`;
    if (goal_id) {
      const goal = goals.get(goal_id);
      if (goal) goal.tasks.push(taskId);
    }
    return { success: true, task_id: taskId, title, description, priority: priority || 'medium', goal_id };
  },
});

registerTool({
  name: 'task.update',
  description: 'Update a task',
  category: 'workflow',
  schema: z.object({
    task_id: z.string(),
    status: z.enum(['pending', 'in_progress', 'done', 'failed']).optional(),
    description: z.string().optional(),
  }),
  handler: async (input) => {
    const { task_id, status, description } = input as { task_id: string; status?: string; description?: string };
    return { success: true, task_id, status, description, updated_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'task.list',
  description: 'List all tasks',
  category: 'workflow',
  schema: z.object({ goal_id: z.string().optional() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id?: string };
    return { tasks: [], goal_id, count: 0 };
  },
});

// Scheduler tools
registerTool({
  name: 'scheduler.run_at',
  description: 'Schedule a task to run at a specific time',
  category: 'workflow',
  schema: z.object({ task: z.string(), run_at: z.string() }),
  handler: async (input) => {
    const { task, run_at } = input as { task: string; run_at: string };
    const id = `schedule-${Date.now()}`;
    schedule.set(id, { task, runAt: run_at });
    return { success: true, schedule_id: id, task, run_at };
  },
});

registerTool({
  name: 'scheduler.run_every',
  description: 'Schedule a recurring task',
  category: 'workflow',
  schema: z.object({ task: z.string(), interval: z.string() }),
  handler: async (input) => {
    const { task, interval } = input as { task: string; interval: string };
    const id = `schedule-${Date.now()}`;
    schedule.set(id, { task, runAt: new Date().toISOString(), recurrence: interval });
    return { success: true, schedule_id: id, task, interval };
  },
});

registerTool({
  name: 'scheduler.pause',
  description: 'Pause a scheduled task',
  category: 'workflow',
  schema: z.object({ schedule_id: z.string() }),
  handler: async (input) => {
    const { schedule_id } = input as { schedule_id: string };
    return { success: true, schedule_id, paused: true };
  },
});

registerTool({
  name: 'scheduler.resume',
  description: 'Resume a paused scheduled task',
  category: 'workflow',
  schema: z.object({ schedule_id: z.string() }),
  handler: async (input) => {
    const { schedule_id } = input as { schedule_id: string };
    return { success: true, schedule_id, resumed: true };
  },
});

registerTool({
  name: 'scheduler.cancel',
  description: 'Cancel a scheduled task',
  category: 'workflow',
  schema: z.object({ schedule_id: z.string() }),
  handler: async (input) => {
    const { schedule_id } = input as { schedule_id: string };
    schedule.delete(schedule_id);
    return { success: true, schedule_id, cancelled: true };
  },
});

// Autopilot tools
let autopilotStatus = 'stopped';

registerTool({
  name: 'autopilot.start',
  description: 'Start the autopilot mode',
  category: 'workflow',
  schema: z.object({ goal_id: z.string().optional() }),
  handler: async (input) => {
    const { goal_id } = input as { goal_id?: string };
    autopilotStatus = 'running';
    return { success: true, status: autopilotStatus, goal_id, started_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'autopilot.stop',
  description: 'Stop the autopilot mode',
  category: 'workflow',
  schema: z.object({}),
  handler: async () => {
    autopilotStatus = 'stopped';
    return { success: true, status: autopilotStatus };
  },
});

registerTool({
  name: 'autopilot.status',
  description: 'Get autopilot status',
  category: 'workflow',
  schema: z.object({}),
  handler: async () => ({ status: autopilotStatus }),
});

registerTool({
  name: 'autopilot.heartbeat',
  description: 'Send autopilot heartbeat',
  category: 'workflow',
  schema: z.object({}),
  handler: async () => ({
    alive: autopilotStatus === 'running',
    status: autopilotStatus,
    timestamp: new Date().toISOString(),
  }),
});

registerTool({
  name: 'autopilot.checkpoint',
  description: 'Create an autopilot checkpoint',
  category: 'workflow',
  schema: z.object({ label: z.string().optional() }),
  handler: async (input) => {
    const { label } = input as { label?: string };
    return {
      checkpoint_id: `ckpt-${Date.now()}`,
      label: label || `checkpoint-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  },
});

registerTool({
  name: 'autopilot.rollback',
  description: 'Rollback to a previous checkpoint',
  category: 'workflow',
  schema: z.object({ checkpoint_id: z.string() }),
  handler: async (input) => {
    const { checkpoint_id } = input as { checkpoint_id: string };
    return { success: true, rolled_back_to: checkpoint_id, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'autopilot.escalate',
  description: 'Escalate an issue to a human',
  category: 'workflow',
  schema: z.object({ reason: z.string(), severity: z.enum(['low', 'medium', 'high', 'critical']).optional() }),
  handler: async (input) => {
    const { reason, severity } = input as { reason: string; severity?: string };
    logger.warn('Autopilot escalation', { reason, severity });
    return { escalated: true, reason, severity: severity || 'medium', timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'autopilot.sleep_until',
  description: 'Put autopilot to sleep until a specified time',
  category: 'workflow',
  schema: z.object({ until: z.string() }),
  handler: async (input) => {
    const { until } = input as { until: string };
    autopilotStatus = 'sleeping';
    return { success: true, sleeping_until: until, status: autopilotStatus };
  },
});
