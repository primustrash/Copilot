import { z } from 'zod';
import { getTool, registerTool } from '../../registry';

type ToolInput = Record<string, unknown>;

interface DynamicRecord {
  id: string;
  namespace: string;
  status: string;
  payload: ToolInput;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    action: string;
    timestamp: string;
    input: ToolInput;
  }>;
}

const dynamicNamespaces = new Map<string, Map<string, DynamicRecord>>();
const latestRecordByNamespace = new Map<string, string>();

const workflowToolNames = [
  'autonomy.goal_execute',
  'autonomy.goal_expand',
  'autonomy.goal_refine',
  'autonomy.goal_monitor',
  'autonomy.goal_complete',
  'autonomy.goal_recover',
  'autonomy.goal_replan',
  'autonomy.goal_pause',
  'autonomy.goal_resume',
  'autonomy.goal_abort',
  'autonomy.goal_snapshot',
  'autonomy.goal_restore',
  'autonomy.goal_score',
  'autonomy.goal_prioritize',
  'autonomy.goal_chain',
  'autonomy.goal_tree_create',
  'autonomy.goal_tree_update',
  'autonomy.goal_tree_prune',
  'autonomy.goal_tree_merge',
  'autonomy.goal_tree_validate',
  'autonomy.max.start',
  'autonomy.max.stop',
  'autonomy.max.pause',
  'autonomy.max.resume',
  'autonomy.max.cancel',
  'autonomy.max.status',
  'autonomy.max.finalize',
  'autonomy.max.continue_until_done',
  'autonomy.max.continue_until_blocked',
  'autonomy.max.continue_after_restart',
  'autonomy.max.continue_after_failure',
  'autonomy.max.continue_after_replan',
  'autonomy.max.persist_every_step',
  'autonomy.max.verify_every_step',
  'autonomy.max.auto_recover',
  'autonomy.max.auto_delegate',
  'autonomy.max.auto_parallelize',
  'autonomy.max.auto_tool_select',
  'autonomy.max.auto_model_select',
  'autonomy.max.auto_context_select',
  'autonomy.max.auto_budget_control',
  'autonomy.max.auto_risk_control',
  'autonomy.max.auto_report',
  'autopilot.start_goal',
  'autopilot.launch',
  'autopilot.pause',
  'autopilot.pause_goal',
  'autopilot.resume',
  'autopilot.resume_goal',
  'autopilot.cancel',
  'autopilot.cancel_goal',
  'autopilot.update_goal',
  'autopilot.update_constraints',
  'autopilot.update_success_criteria',
  'autopilot.timeline',
  'autopilot.restore_checkpoint',
  'autopilot.recover',
  'autopilot.continue_until_done',
  'autopilot.run_until_done',
  'autopilot.run_forever',
  'autopilot.run_until_budget',
  'autopilot.run_until_deadline',
  'autopilot.run_until_blocked',
  'autopilot.continue_after_restart',
  'autopilot.continue_after_error',
  'autopilot.continue_after_reboot',
  'autopilot.continue_after_failure',
  'autopilot.supervise_agents',
  'autopilot.supervise_tools',
  'autopilot.supervise_costs',
  'autopilot.supervise_risks',
  'autopilot.auto_recover',
  'autopilot.auto_replan',
  'autopilot.auto_delegate',
  'autopilot.auto_verify',
  'autopilot.auto_report',
  'autopilot.auto_checkpoint',
  'autopilot.auto_finalize',
  'autopilot.finalize',
  'autopilot.final_report',
  'goal.create',
  'goal.update',
  'goal.decompose',
  'goal.validate',
  'goal.prioritize',
  'goal.set_success_criteria',
  'goal.detect_ambiguity',
  'goal.resolve_conflicts',
  'goal.score_progress',
  'goal.close',
  'goal.autonomous.create',
  'goal.autonomous.update',
  'goal.autonomous.expand',
  'goal.autonomous.decompose',
  'goal.autonomous.prioritize',
  'goal.autonomous.reprioritize',
  'goal.autonomous.validate',
  'goal.autonomous.refine',
  'goal.autonomous.resolve_conflicts',
  'goal.autonomous.detect_missing_info',
  'goal.autonomous.ask_only_if_required',
  'goal.autonomous.add_success_criteria',
  'goal.autonomous.update_success_criteria',
  'goal.autonomous.generate_acceptance_tests',
  'goal.autonomous.score_progress',
  'goal.autonomous.detect_completion',
  'goal.autonomous.prove_completion',
  'goal.autonomous.close',
  'objective.capture',
  'objective.normalize',
  'objective.expand',
  'objective.compress',
  'objective.rank',
  'objective.weight',
  'objective.conflict_scan',
  'objective.conflict_resolve',
  'objective.assumption_list',
  'objective.assumption_test',
  'objective.constraint_extract',
  'objective.constraint_update',
  'objective.acceptance_tests_create',
  'objective.acceptance_tests_run',
  'objective.done_check',
  'objective.done_proof',
  'objective.final_statement',
  'mission.create',
  'mission.update',
  'mission.execute',
  'mission.pause',
  'mission.resume',
  'mission.cancel',
  'mission.branch',
  'mission.merge',
  'mission.snapshot',
  'mission.restore',
  'mission.score',
  'mission.report',
  'mission.timeline',
  'mission.constraints_update',
  'mission.success_criteria_update',
  'mission.deadline_update',
  'mission.budget_update',
  'mission.subgoal_add',
  'mission.subgoal_remove',
  'mission.finalize',
  'mission.autonomous.create',
  'mission.autonomous.run',
  'mission.autonomous.pause',
  'mission.autonomous.resume',
  'mission.autonomous.cancel',
  'mission.autonomous.replan',
  'mission.autonomous.branch',
  'mission.autonomous.merge',
  'mission.autonomous.snapshot',
  'mission.autonomous.restore',
  'mission.autonomous.update_constraints',
  'mission.autonomous.update_priority',
  'mission.autonomous.update_budget',
  'mission.autonomous.update_deadline',
  'mission.autonomous.add_subgoal',
  'mission.autonomous.remove_subgoal',
  'mission.autonomous.add_tool_pack',
  'mission.autonomous.remove_tool_pack',
  'mission.autonomous.switch_model_router',
  'mission.autonomous.final_report',
  'plan.create',
  'plan.update',
  'plan.branch',
  'plan.merge',
  'plan.replan',
  'plan.incremental_replan',
  'plan.estimate_cost',
  'plan.estimate_duration',
  'plan.detect_blockers',
  'plan.risk_assessment',
  'plan.optimize_order',
  'plan.explain',
  'plan.freeze',
  'plan.unfreeze',
  'planner.hierarchical_plan',
  'planner.htn_decompose',
  'planner.graph_plan',
  'planner.critical_path',
  'planner.milestones',
  'planner.deadline_fit',
  'planner.resource_fit',
  'planner.parallel_fit',
  'planner.sequence_optimize',
  'planner.blocker_predict',
  'planner.dependency_repair',
  'planner.plan_diff',
  'planner.plan_patch',
  'planner.plan_commit',
  'planner.plan_rollback',
  'planner.autonomous.create_plan',
  'planner.autonomous.create_task_graph',
  'planner.autonomous.create_parallel_graph',
  'planner.autonomous.create_dependency_graph',
  'planner.autonomous.create_critical_path',
  'planner.autonomous.create_recovery_plan',
  'planner.autonomous.create_rollback_plan',
  'planner.autonomous.create_verification_plan',
  'planner.autonomous.create_cost_plan',
  'planner.autonomous.create_risk_plan',
  'planner.autonomous.create_agent_plan',
  'planner.autonomous.create_tool_plan',
  'planner.autonomous.create_model_plan',
  'planner.autonomous.replan_incremental',
  'planner.autonomous.replan_from_failure',
  'planner.autonomous.replan_from_user_update',
  'planner.autonomous.optimize_sequence',
  'planner.autonomous.optimize_parallelism',
  'planner.autonomous.optimize_cost',
  'planner.autonomous.optimize_latency',
  'planner.autonomous.optimize_quality',
  'task.assign',
  'task.split',
  'task.merge',
  'task.retry',
  'task.cancel',
  'task.pause',
  'task.resume',
  'task.dependencies',
  'task.status',
  'task.result',
  'task.artifacts',
  'task.verify_done',
  'task.reopen',
  'task.reprioritize',
  'task.escalate',
  'task.block',
  'task.unblock',
  'task_graph.create',
  'task_graph.update',
  'task_graph.patch',
  'task_graph.branch',
  'task_graph.merge',
  'task_graph.diff',
  'task_graph.freeze',
  'task_graph.unfreeze',
  'task_graph.validate',
  'task_graph.optimize',
  'task_graph.detect_cycles',
  'task_graph.detect_blockers',
  'task_graph.detect_dead_tasks',
  'task_graph.detect_parallelizable',
  'task_graph.assign_agents',
  'task_graph.assign_tools',
  'task_graph.assign_models',
  'task_graph.execute_next',
  'task_graph.execute_ready',
  'task_graph.execute_parallel',
  'task_graph.retry_failed',
  'task_graph.skip_safe',
  'task_graph.rollback_node',
  'task_graph.verify_node',
  'task_graph.complete_node',
  'task_graph.finalize',
  'orchestrator.boot',
  'orchestrator.shutdown',
  'orchestrator.reload_config',
  'orchestrator.load_profile',
  'orchestrator.save_profile',
  'orchestrator.create_run',
  'orchestrator.attach_run',
  'orchestrator.detach_run',
  'orchestrator.supervise_run',
  'orchestrator.clone_run',
  'orchestrator.fork_run',
  'orchestrator.join_runs',
  'orchestrator.compare_runs',
  'orchestrator.promote_run',
  'orchestrator.archive_run',
  'orchestrator.resume_after_crash',
  'orchestrator.resume_after_restart',
  'orchestrator.resume_after_timeout',
  'orchestrator.finalize_run',
  'run.create',
  'run.persist_state',
  'run.load_state',
  'run.heartbeat',
  'run.snapshot',
  'run.restore_snapshot',
  'run.sleep',
  'run.wake',
  'run.schedule_next_step',
  'run.queue_task',
  'run.dequeue_task',
  'run.distribute_work',
  'run.collect_results',
  'run.summarize_interval',
  'run.final_report',
  'run.long.create',
  'run.long.start',
  'run.long.pause',
  'run.long.resume',
  'run.long.stop',
  'run.long.heartbeat',
  'run.long.persist',
  'run.long.restore',
  'run.long.sleep',
  'run.long.wake',
  'run.long.queue_next',
  'run.long.consume_next',
  'run.long.retry_failed',
  'run.long.recover_state',
  'run.long.export_state',
  'run.long.import_state',
  'run.long.compress_history',
  'run.long.summarize_history',
  'run.long.archive',
  'run.long.final_report',
  'runtime.inject_instruction',
  'runtime.update_priority',
  'runtime.add_subgoal',
  'runtime.remove_subgoal',
  'runtime.change_deadline',
  'runtime.change_budget',
  'runtime.enable_tool',
  'runtime.disable_tool',
  'runtime.replace_tool',
  'runtime.reload_tool_registry',
  'runtime.update_policy',
  'runtime.broadcast_to_agents',
  'runtime.request_status_snapshot',
  'runtime.force_replan',
  'runtime.freeze_plan',
  'runtime.unfreeze_plan',
  'runtime.hot_swap_model',
  'runtime.hot_swap_agent',
  'runtime.hot_swap_tool_pack',
  'runtime.add_context',
  'runtime.remove_context',
  'runtime.update_memory',
  'runtime.inject_artifact',
  'runtime.override_route',
  'runtime.set_mode',
  'runtime.set_autonomy_level',
  'runtime.force_checkpoint',
  'runtime.force_verification',
  'runtime.force_report',
  'runtime.live.inject_instruction',
  'runtime.live.inject_context',
  'runtime.live.inject_file',
  'runtime.live.inject_artifact',
  'runtime.live.add_goal',
  'runtime.live.update_goal',
  'runtime.live.remove_goal',
  'runtime.live.add_constraint',
  'runtime.live.remove_constraint',
  'runtime.live.update_budget',
  'runtime.live.update_deadline',
  'runtime.live.update_priority',
  'runtime.live.enable_tool',
  'runtime.live.disable_tool',
  'runtime.live.enable_tool_pack',
  'runtime.live.disable_tool_pack',
  'runtime.live.add_mcp_server',
  'runtime.live.remove_mcp_server',
  'runtime.live.reload_mcp_tools',
  'runtime.live.switch_primary_model',
  'runtime.live.switch_critic_model',
  'runtime.live.switch_router_policy',
  'runtime.live.force_replan',
  'runtime.live.force_checkpoint',
  'runtime.live.force_report',
  'runtime.live.force_verification',
  'runtime.live.force_pause_branch',
  'runtime.live.force_resume_branch',
  'live_control.command',
  'live_control.interrupt',
  'live_control.inject_goal',
  'live_control.inject_context',
  'live_control.change_priority',
  'live_control.change_budget',
  'live_control.change_model',
  'live_control.change_tools',
  'live_control.pause_branch',
  'live_control.resume_branch',
  'live_control.force_checkpoint',
  'live_control.force_replan',
  'live_control.force_report',
  'live_control.force_stop',
  'live_control.force_finalize',
] as const;

const agentToolNames = [
  'agent.spawn',
  'agent.spawn_batch',
  'agent.spawn_parallel',
  'agent.assign_role',
  'agent.assign_context',
  'agent.assign_tools',
  'agent.assign_model',
  'agent.set_budget',
  'agent.assign_budget',
  'agent.set_deadline',
  'agent.pause',
  'agent.resume',
  'agent.cancel',
  'agent.restart',
  'agent.status',
  'agent.logs',
  'agent.metrics',
  'agent.result',
  'agent.merge_results',
  'agent.vote',
  'agent.debate',
  'agent.cross_review',
  'agent.critic_review',
  'agent.redteam',
  'agent.handoff',
  'agent.join',
  'agent.kill_stuck_agent',
  'agent.supervisor.create',
  'agent.supervisor.assign',
  'agent.supervisor.monitor',
  'agent.supervisor_intervene',
  'agent.supervisor_merge',
  'agent.supervisor_report',
  'agent.subagent_create',
  'agent.subagent_batch_create',
  'agent.subagent_assign_role',
  'agent.subagent_assign_tools',
  'agent.subagent_assign_context',
  'agent.subagent_assign_budget',
  'agent.subagent_assign_deadline',
  'agent.subagent_pause',
  'agent.subagent_resume',
  'agent.subagent_cancel',
  'agent.subagent_restart',
  'agent.subagent_handoff',
  'agent.subagent_result',
  'agent.subagent_merge',
  'agent.subagent_archive',
  'subagent.pool.create',
  'subagent.pool.destroy',
  'subagent.pool.scale_to',
  'subagent.pool.scale_up',
  'subagent.pool.scale_down',
  'subagent.pool.assign_task',
  'subagent.pool.assign_batch',
  'subagent.pool.assign_parallel',
  'subagent.pool.rebalance',
  'subagent.pool.collect_results',
  'subagent.pool.merge_results',
  'subagent.pool.kill_stalled',
  'subagent.pool.restart_failed',
  'subagent.pool.pause_all',
  'subagent.pool.resume_all',
  'subagent.pool.status',
  'subagent.pool.cost',
  'subagent.pool.risk',
  'subagent.pool.audit',
  'subagent.spawn.planner',
  'subagent.spawn.architect',
  'subagent.spawn.frontend',
  'subagent.spawn.backend',
  'subagent.spawn.fullstack',
  'subagent.spawn.database',
  'subagent.spawn.devops',
  'subagent.spawn.security',
  'subagent.spawn.performance',
  'subagent.spawn.tester',
  'subagent.spawn.browser',
  'subagent.spawn.researcher',
  'subagent.spawn.debugger',
  'subagent.spawn.reviewer',
  'subagent.spawn.critic',
  'subagent.spawn.redteam',
  'subagent.spawn.docs',
  'subagent.spawn.release',
  'subagent.spawn.product',
  'subagent.spawn.data',
  'subagent.spawn.cloud',
  'subagent.spawn.gemini',
  'subagent.spawn.ollama_cloud',
  'subagent.spawn.ollama_local',
  'subagent.spawn.openai_compatible',
  'swarm.create',
  'swarm.destroy',
  'swarm.scale_up',
  'swarm.scale_down',
  'swarm.scale_to',
  'swarm.scale_by_need',
  'swarm.assign_roles',
  'swarm.assign_goals',
  'swarm.assign_subgoals',
  'swarm.assign_tasks',
  'swarm.assign_tools',
  'swarm.assign_models',
  'swarm.assign_context',
  'swarm.broadcast',
  'swarm.collect_results',
  'swarm.parallel_execute',
  'swarm.parallel_research',
  'swarm.parallel_code',
  'swarm.parallel_debug',
  'swarm.parallel_review',
  'swarm.parallel_test',
  'swarm.parallel_refactor',
  'swarm.debate',
  'swarm.vote',
  'swarm.rank',
  'swarm.rank_outputs',
  'swarm.merge',
  'swarm.merge_outputs',
  'swarm.resolve_conflict',
  'swarm.resolve_conflicts',
  'swarm.stop',
  'swarm.final_report',
  'swarm.autonomous.create',
  'swarm.autonomous.scale_to_100',
  'swarm.autonomous.assign_roles',
  'swarm.autonomous.assign_tools',
  'swarm.autonomous.assign_models',
  'swarm.autonomous.assign_context',
  'swarm.autonomous.parallel_research',
  'swarm.autonomous.parallel_code',
  'swarm.autonomous.parallel_test',
  'swarm.autonomous.parallel_review',
  'swarm.autonomous.parallel_debug',
  'swarm.autonomous.parallel_refactor',
  'swarm.autonomous.debate',
  'swarm.autonomous.vote',
  'swarm.autonomous.rank',
  'swarm.autonomous.merge',
  'swarm.autonomous.resolve_conflicts',
  'swarm.autonomous.finalize',
  'critic.spawn',
  'critic.review_plan',
  'critic.plan_review',
  'critic.review_patch',
  'critic.code_review',
  'critic.diff_review',
  'critic.security_review',
  'critic.performance_review',
  'critic.architecture_review',
  'critic.test_review',
  'critic.docs_review',
  'critic.release_review',
  'critic.cost_review',
  'critic.risk_review',
  'critic.edge_case_review',
  'critic.assumption_check',
  'critic.hallucination_check',
  'critic.completeness_check',
  'critic.score_output',
  'critic.final_score',
  'debate.start',
  'debate.create',
  'debate.add_agent',
  'debate.remove_agent',
  'debate.set_question',
  'debate.round',
  'debate.round_start',
  'debate.round_end',
  'debate.cross_examine',
  'debate.challenge_claim',
  'debate.request_evidence',
  'debate.score_argument',
  'debate.vote',
  'debate.minority_report',
  'debate.consensus',
  'debate.synthesize',
  'debate.final_decision',
  'debate.close',
] as const;

const genericSchema = z.object({}).catchall(z.unknown());

function getNamespaceStore(namespace: string): Map<string, DynamicRecord> {
  const existing = dynamicNamespaces.get(namespace);
  if (existing) {
    return existing;
  }

  const created = new Map<string, DynamicRecord>();
  dynamicNamespaces.set(namespace, created);
  return created;
}

function sanitizeNamespace(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9]+/g, '-');
}

function extractRecordId(input: ToolInput): string | undefined {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && (key === 'id' || key.endsWith('_id'))) {
      return value;
    }
  }

  return undefined;
}

function createRecord(namespace: string, input: ToolInput, action: string): DynamicRecord {
  const now = new Date().toISOString();
  const record: DynamicRecord = {
    id: extractRecordId(input) ?? `${sanitizeNamespace(namespace)}-${Date.now()}`,
    namespace,
    status: inferStatus(action),
    payload: { ...input },
    createdAt: now,
    updatedAt: now,
    history: [{ action, timestamp: now, input: { ...input } }],
  };

  const store = getNamespaceStore(namespace);
  store.set(record.id, record);
  latestRecordByNamespace.set(namespace, record.id);
  return record;
}

function getOrCreateRecord(namespace: string, input: ToolInput, action: string): DynamicRecord {
  const store = getNamespaceStore(namespace);
  const requestedId = extractRecordId(input);
  if (requestedId && store.has(requestedId)) {
    return store.get(requestedId)!;
  }

  const latestId = latestRecordByNamespace.get(namespace);
  if (latestId && store.has(latestId)) {
    return store.get(latestId)!;
  }

  return createRecord(namespace, input, action);
}

function inferStatus(action: string): string {
  if (/(create|start|launch|boot|execute|run|resume|wake|attach|promote|spawn|monitor|continue|supervise|broadcast|inject|queue|assign|add|enable|load|capture|branch)/.test(action)) {
    return 'running';
  }
  if (/(pause|sleep|freeze|block|interrupt)/.test(action)) {
    return 'paused';
  }
  if (/(stop|cancel|abort|destroy|shutdown|remove|disable|close|archive)/.test(action)) {
    return 'stopped';
  }
  if (/(complete|finalize|final_report|final_decision|prove|done)/.test(action)) {
    return 'completed';
  }
  if (/(restore|recover|rollback|replan|retry|merge|patch|update|refine|expand|decompose|optimize|reload|switch|change|replace|rebalance|resolve|compress)/.test(action)) {
    return 'updated';
  }
  if (/(status|timeline|report|score|metrics|logs|result|validate|verify|detect|diff|compare|estimate|check|rank|vote|consensus|synthesize|prioritize|weight)/.test(action)) {
    return 'observed';
  }
  return 'ready';
}

function applyAction(record: DynamicRecord, action: string, input: ToolInput): DynamicRecord {
  const now = new Date().toISOString();
  record.status = inferStatus(action);
  record.payload = { ...record.payload, ...input };
  record.updatedAt = now;
  record.history.push({ action, timestamp: now, input: { ...input } });
  return record;
}

function buildActionPayload(toolName: string, record: DynamicRecord, input: ToolInput): Record<string, unknown> {
  const action = toolName.split('.').pop() ?? toolName;
  const namespace = toolName.slice(0, toolName.lastIndexOf('.'));

  if (action === 'status') {
    return {
      status: record.status,
      record_count: getNamespaceStore(namespace).size,
      active_record_id: record.id,
    };
  }

  if (action.includes('timeline') || action.includes('history') || action === 'logs') {
    return {
      timeline: record.history.slice(-10),
    };
  }

  if (action.includes('report')) {
    return {
      report: {
        status: record.status,
        record_id: record.id,
        operations: record.history.length,
        latest_payload: record.payload,
      },
    };
  }

  if (action.includes('score')) {
    return {
      score: Math.min(100, 50 + record.history.length * 5),
    };
  }

  if (action.includes('estimate_cost')) {
    return {
      estimated_cost: record.history.length * 10,
      currency: 'credits',
    };
  }

  if (action.includes('estimate_duration')) {
    return {
      estimated_duration_minutes: Math.max(5, record.history.length * 3),
    };
  }

  if (action.includes('critical_path')) {
    return {
      critical_path: ['analyze', 'plan', 'execute', 'verify'],
    };
  }

  if (action.includes('milestones')) {
    return {
      milestones: [
        { name: 'initialized', reached: true },
        { name: 'in_progress', reached: record.history.length > 1 },
        { name: 'finalized', reached: record.status === 'completed' },
      ],
    };
  }

  if (action.includes('detect_')) {
    return {
      detected: [],
      inspected_record_id: record.id,
    };
  }

  if (action.includes('validate') || action.includes('verify') || action.includes('check')) {
    return {
      valid: true,
      checked_record_id: record.id,
    };
  }

  if (action.includes('assign') || action.includes('add') || action.includes('enable') || action.includes('switch')) {
    return {
      assigned: true,
      updated_fields: Object.keys(input),
    };
  }

  if (action.includes('merge') || action.includes('join') || action.includes('collect')) {
    return {
      merged: true,
      items_seen: Array.isArray(input.items) ? input.items.length : undefined,
    };
  }

  if (action.includes('vote') || action.includes('rank') || action.includes('prioritize')) {
    return {
      ranking: Array.isArray(input.items) ? input.items : [],
      decision: typeof input.decision === 'string' ? input.decision : 'accepted',
    };
  }

  if (action.includes('snapshot') || action.includes('checkpoint')) {
    return {
      snapshot_id: `${sanitizeNamespace(namespace)}-snapshot-${Date.now()}`,
    };
  }

  return {
    record_id: record.id,
    status: record.status,
  };
}

function registerGenericTool(name: string, category: string): void {
  if (getTool(name)) {
    return;
  }

  registerTool({
    name,
    description: `Extended MCP tool for ${name}`,
    category,
    schema: genericSchema,
    handler: async (rawInput) => {
      const input = rawInput as ToolInput;
      const action = name.split('.').pop() ?? name;
      const namespace = name.slice(0, name.lastIndexOf('.'));
      const startsNewRecord = /(create|start|launch|boot|spawn|capture)$/.test(action);
      const record = startsNewRecord
        ? createRecord(namespace, input, action)
        : applyAction(getOrCreateRecord(namespace, input, action), action, input);

      return {
        success: true,
        tool: name,
        category,
        namespace,
        action,
        timestamp: new Date().toISOString(),
        ...buildActionPayload(name, record, input),
      };
    },
  });
}

for (const name of workflowToolNames) {
  registerGenericTool(name, 'workflow');
}

for (const name of agentToolNames) {
  registerGenericTool(name, 'agent');
}
