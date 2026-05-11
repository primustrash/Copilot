import { z } from 'zod';
import { getTool, getToolNames, registerTool } from '../../registry';
import { config } from '../../utils/config';

type ToolInput = Record<string, unknown>;

interface CloudAgentRecord {
  id: string;
  provider: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  payload: ToolInput;
}

interface ProviderRecord {
  id: string;
  status: 'healthy' | 'degraded' | 'offline';
  endpoint?: string;
  apiKeyConfigured: boolean;
  updatedAt: string;
}

interface FunctionRecord {
  name: string;
  schema?: unknown;
  metadata?: ToolInput;
  updatedAt: string;
}

interface SessionRecord {
  id: string;
  status: 'connected' | 'disconnected';
  updatedAt: string;
}

interface McpServerRecord {
  id: string;
  url: string;
  status: 'configured' | 'running' | 'stopped';
  auth: {
    mode: string;
    header?: string;
    bearer?: boolean;
    basic?: boolean;
    oauth?: {
      authorizationUrl?: string;
      tokenUrl?: string;
      clientIdConfigured: boolean;
      clientSecretConfigured: boolean;
    };
  };
  capabilities: string[];
  updatedAt: string;
}

const genericSchema = z.object({}).catchall(z.unknown());
let sequence = 0;

const cloudAgents = new Map<string, CloudAgentRecord>();
const providers = new Map<string, ProviderRecord>([
  ['openai', { id: 'openai', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['anthropic', { id: 'anthropic', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['gemini', { id: 'gemini', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['ollama', { id: 'ollama', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['openrouter', { id: 'openrouter', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['groq', { id: 'groq', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['mistral', { id: 'mistral', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['deepseek', { id: 'deepseek', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
  ['together', { id: 'together', status: 'healthy', apiKeyConfigured: false, updatedAt: new Date().toISOString() }],
]);
const functionRegistry = new Map<string, FunctionRecord>();
const mcpClientSessions = new Map<string, SessionRecord>();
const mcpServers = new Map<string, McpServerRecord>();
const toolRegistryState = new Map<string, ToolInput>();
const genericNamespaceState = new Map<string, { id: string; history: Array<{ action: string; at: string; input: ToolInput }>; payload: ToolInput }>();

const modelCatalog = [
  { id: 'gpt-4o', provider: 'openai', capabilities: ['chat', 'tool_calling', 'reasoning'], contextWindow: 128000 },
  { id: 'gpt-4o-mini', provider: 'openai', capabilities: ['chat', 'fast'], contextWindow: 128000 },
  { id: 'claude-3-5-sonnet', provider: 'anthropic', capabilities: ['chat', 'analysis', 'tool_calling'], contextWindow: 200000 },
  { id: 'gemini-2.5-pro', provider: 'gemini', capabilities: ['chat', 'multimodal', 'long_context'], contextWindow: 1000000 },
  { id: 'gemini-2.5-flash', provider: 'gemini', capabilities: ['chat', 'fast', 'multimodal'], contextWindow: 1000000 },
  { id: 'llama3.1:8b', provider: 'ollama', capabilities: ['chat', 'local', 'privacy'], contextWindow: 32768 },
];

mcpServers.set('primusnex', {
  id: 'primusnex',
  url: config.auth.remoteProfiles.primusnex.mcpUrl,
  status: 'configured',
  auth: {
    mode: 'api-key-or-oauth2',
    header: config.auth.remoteProfiles.primusnex.apiKeyHeader,
    bearer: true,
    basic: false,
    oauth: {
      authorizationUrl: config.auth.remoteProfiles.primusnex.oauthAuthUrl,
      tokenUrl: config.auth.remoteProfiles.primusnex.oauthTokenUrl,
      clientIdConfigured: Boolean(config.auth.remoteProfiles.primusnex.clientId),
      clientSecretConfigured: Boolean(config.auth.remoteProfiles.primusnex.clientSecret),
    },
  },
  capabilities: ['tools', 'resources', 'prompts', 'oauth2', 'api-key'],
  updatedAt: new Date().toISOString(),
});

function parseNameBlock(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, '').replace(/^"/, '').replace(/"$/, ''))
    .filter(Boolean);
}

const section5Names = parseNameBlock(`
"cloud_agent.spawn",
"cloud_agent.delegate",
"cloud_agent.parallel_delegate",
"cloud_agent.stream",
"cloud_agent.pause",
"cloud_agent.resume",
"cloud_agent.cancel",
"cloud_agent.result",
"cloud_agent.merge",
"cloud_agent.debate",
"cloud_agent.critic",
"cloud_agent.redteam",
"cloud_agent.long_context_review",
"cloud_agent.merge_findings",
"cloud_agent.vote",
"cloud_agent.shutdown",
"cloud_agent.spawn_gemini",
"cloud_agent.spawn_ollama",
"cloud_agent.spawn_openai",
"cloud_agent.spawn_anthropic",
"cloud_agent.spawn_openrouter",
"cloud_agent.spawn_groq",
"cloud_agent.spawn_mistral",
"cloud_agent.spawn_deepseek",
"cloud_agent.spawn_together",
"cloud_agent.gemini.spawn",
"cloud_agent.gemini.delegate",
"cloud_agent.gemini.parallel_delegate",
"cloud_agent.gemini.long_context_review",
"cloud_agent.gemini.function_call_plan",
"cloud_agent.gemini.tool_selection",
"cloud_agent.gemini.tool_argument_generate",
"cloud_agent.gemini.tool_result_interpret",
"cloud_agent.gemini.code_review",
"cloud_agent.gemini.security_review",
"cloud_agent.gemini.architecture_review",
"cloud_agent.gemini.test_generation",
"cloud_agent.gemini.debug_reasoning",
"cloud_agent.gemini.multimodal_review",
"cloud_agent.gemini.grounded_research",
"cloud_agent.gemini.critic",
"cloud_agent.gemini.redteam",
"cloud_agent.gemini.merge_findings",
"cloud_agent.gemini.shutdown",
"cloud_agent.ollama.spawn",
"cloud_agent.ollama.delegate",
"cloud_agent.ollama.parallel_delegate",
"cloud_agent.ollama.fast_summary",
"cloud_agent.ollama.code_review",
"cloud_agent.ollama.patch_review",
"cloud_agent.ollama.test_review",
"cloud_agent.ollama.error_analysis",
"cloud_agent.ollama.route_fast_tasks",
"cloud_agent.ollama.local_fallback",
"cloud_agent.ollama.cloud_fallback",
"cloud_agent.ollama.privacy_review",
"cloud_agent.ollama.critic",
"cloud_agent.ollama.merge_findings",
"cloud_agent.ollama.shutdown",
"model.list",
"model.capabilities",
"model.pricing.get",
"model.latency.check",
"model.pick_for_task",
"model.provider.list",
"model.provider.add",
"model.provider.remove",
"model.provider_update",
"model.provider_healthcheck",
"model.provider_latency",
"model.provider_cost",
"model.provider_capabilities",
"model.provider_context_window",
"model.provider_modalities",
"model.provider_rate_limits",
"model.provider_usage",
"model.provider_failover",
"model.provider_key_rotate",
"model.provider_key_validate",
"model.provider_quota_check",
"model.router.select",
"model.router.call",
"model.router.stream",
"model.router.batch_call",
"model.router.parallel_call",
"model.router.compare",
"model.router.rank",
"model.router.merge",
"model.router.failover",
"model.router.estimate_cost",
"model.router.limit_cost",
"model.router.cache_lookup",
"model.router.cache_store",
"model.router.healthcheck",
"model.router.audit_call",
"model.router.redact_prompt",
"model.router.route_by_task",
"model.router.route_by_cost",
"model.router.route_by_latency",
"model.router.route_by_context_window",
"model.router.route_by_modality",
"model.router.intent_detect",
"model.router.task_classify",
"model.router.capability_match",
"model.router.cost_optimize",
"model.router.latency_optimize",
"model.router.quality_optimize",
"model.router.privacy_optimize",
"model.router.context_optimize",
"model.router.modality_optimize",
"model.router.select_primary",
"model.router.select_fallback",
"model.router.select_critic",
"model.router.select_tester",
"model.router.multi_call",
"model.router.best_of_n",
"model.router.majority_vote",
"model.router.consensus_merge",
"model.router.cache_result",
"model.router.audit",
"model_router.smart.detect_task_type",
"model_router.smart.detect_required_capabilities",
"model_router.smart.detect_context_size",
"model_router.smart.detect_modality",
"model_router.smart.detect_privacy_level",
"model_router.smart.detect_risk_level",
"model_router.smart.detect_budget_class",
"model_router.smart.detect_latency_class",
"model_router.smart.select_primary_model",
"model_router.smart.select_secondary_model",
"model_router.smart.select_critic_model",
"model_router.smart.select_fast_model",
"model_router.smart.select_long_context_model",
"model_router.smart.select_multimodal_model",
"model_router.smart.select_private_model",
"model_router.smart.select_cloud_model",
"model_router.smart.select_local_model",
"model_router.smart.select_fallback_model",
"model_router.smart.compare_model_outputs",
"model_router.smart.rank_model_outputs",
"model_router.smart.merge_model_outputs",
"model_router.smart.best_of_n",
"model_router.smart.self_consistency",
"model_router.smart.majority_vote",
"model_router.smart.debate",
"model_router.smart.cache_lookup",
"model_router.smart.cache_store",
"model_router.smart.usage_report",
"gemini.call",
"gemini.stream",
"gemini.generate_content",
"gemini.stream_generate_content",
"gemini.stream_content",
"gemini.chat",
"gemini.count_tokens",
"gemini.embed_content",
"gemini.extract_json",
"gemini.json_extract",
"gemini.structured_output",
"gemini.function_call",
"gemini.function_declare",
"gemini.function_arguments_generate",
"gemini.function_arguments_validate",
"gemini.function_result_continue",
"gemini.long_context",
"gemini.long_context_review",
"gemini.repo_review",
"gemini.code_review",
"gemini.diff_review",
"gemini.diff_analysis",
"gemini.architecture_review",
"gemini.security_review",
"gemini.performance_review",
"gemini.generate_tests",
"gemini.test_generation",
"gemini.refactor_plan",
"gemini.prompt_optimize",
"gemini.docs_lookup",
"gemini.docs_mcp_query",
"gemini.google_search_grounding",
"gemini.multimodal_analyze",
"gemini.multimodal_review",
"gemini.image_analyze",
"gemini.image_reasoning",
"gemini.video_analyze",
"gemini.video_reasoning",
"gemini.audio_analyze",
"gemini.audio_reasoning",
"gemini.agent_critic",
"gemini.agent_planner",
"gemini.agent_researcher",
"gemini.agent_tester",
"gemini.agent_reviewer",
"gemini.cost_estimate",
"gemini.healthcheck",
"gemini.api.generate_content",
"gemini.api.stream_generate_content",
"gemini.api.chat",
"gemini.api.count_tokens",
"gemini.api.embed_content",
"gemini.api.batch_generate",
"gemini.api.file_upload",
"gemini.api.file_list",
"gemini.api.file_get",
"gemini.api.file_delete",
"gemini.api.cache_create",
"gemini.api.cache_get",
"gemini.api.cache_delete",
"gemini.api.models_list",
"gemini.api.model_get",
"gemini.api.healthcheck",
"gemini.api.usage",
"gemini.api.cost_estimate",
"gemini.function.declare_tool",
"gemini.function.declare_tool_pack",
"gemini.function.call_single",
"gemini.function.call_parallel",
"gemini.function.call_composed",
"gemini.function.call_with_builtin_tools",
"gemini.function.call_with_google_search",
"gemini.function.call_with_mcp_tools",
"gemini.function.generate_arguments",
"gemini.function.validate_arguments",
"gemini.function.repair_arguments",
"gemini.function.execute_server_side",
"gemini.function.return_tool_result",
"gemini.function.continue_after_tool",
"gemini.function.summarize_tool_trace",
"gemini.function.audit_tool_calls",
"gemini.mcp.connect_server",
"gemini.mcp.disconnect_server",
"gemini.mcp.list_tools",
"gemini.mcp.select_tools",
"gemini.mcp.call_tool",
"gemini.mcp.call_tool_parallel",
"gemini.mcp.read_resource",
"gemini.mcp.subscribe_resource",
"gemini.mcp.get_prompt",
"gemini.mcp.docs_query",
"gemini.mcp.schema_snapshot",
"gemini.mcp.schema_diff",
"gemini.mcp.permission_check",
"gemini.mcp.safety_check",
"ollama.chat",
"ollama.generate",
"ollama.stream",
"ollama.embeddings",
"ollama.models",
"ollama.pull",
"ollama.delete",
"ollama.show",
"ollama.ps",
"ollama.copy",
"ollama.cloud.call",
"ollama.cloud.stream",
"ollama.cloud.chat",
"ollama.cloud.generate",
"ollama.cloud.model_list",
"ollama.cloud.models",
"ollama.cloud.embeddings",
"ollama.cloud.pull_metadata",
"ollama.cloud.fast_summary",
"ollama.cloud.code_review",
"ollama.cloud.patch_critic",
"ollama.cloud.patch_review",
"ollama.cloud.test_ideas",
"ollama.cloud.test_review",
"ollama.cloud.critic",
"ollama.cloud.local_fallback",
"ollama.cloud.failover",
"ollama.cloud.fallback",
"ollama.cloud.healthcheck",
"ollama.cloud.cost_estimate",
"ollama.cloud.usage",
"ollama.cloud.api.chat",
"ollama.cloud.api.generate",
"ollama.cloud.api.stream",
"ollama.cloud.api.embeddings",
"ollama.cloud.api.models",
"ollama.cloud.api.ps",
"ollama.cloud.api.pull",
"ollama.cloud.api.copy",
"ollama.cloud.api.delete",
"ollama.cloud.api.show",
"ollama.cloud.api.healthcheck",
"ollama.cloud.api.usage",
"ollama.cloud.api.cost_estimate",
"ollama.cloud.api.quota_check",
"ollama.cloud.api.failover",
"ollama.local.call",
"ollama.local.stream",
"ollama.local.chat",
"ollama.local.generate",
"ollama.local.model_list",
"ollama.local.models",
"ollama.local.pull_model",
"ollama.local.pull",
"ollama.local.delete_model",
"ollama.local.delete",
"ollama.local.embeddings",
"ollama.local.ps",
"ollama.local.unload",
"ollama.local.private_reasoning",
"ollama.local.private_review",
"ollama.local.fast_summary",
"ollama.local.code_review",
"ollama.local.fallback",
"ollama.local.healthcheck",
"ollama.openai.chat_completions",
"ollama.openai.responses",
"ollama.openai.embeddings",
"ollama.openai.models",
"ollama.openai.stream",
"ollama.openai.json_mode",
"ollama.openai.tool_schema_proxy",
"ollama.openai.tool_choice_proxy",
"ollama.openai.usage_report",
"ollama.openai.healthcheck",
"llm.openai_compatible_chat",
"llm.openai_compatible_responses",
"llm.openai_compatible_embeddings",
"llm.openai_compatible_models",
"llm.openai_compatible_stream",
"llm.openai_compatible_tool_call",
"llm.openai_compatible_batch",
"llm.openai_compatible_cost",
"llm.openai_compatible_usage",
"llm.openai_compatible_health",
"openai_compatible.provider.add",
"openai_compatible.provider.remove",
"openai_compatible.models",
"openai_compatible.chat_completions",
"openai_compatible.responses",
"openai_compatible.embeddings",
"openai_compatible.stream",
"openai_compatible.tool_call",
"openai_compatible.batch",
"openai_compatible.usage",
"openai_compatible.healthcheck",
"llm.openrouter_chat",
"llm.openrouter_models",
"llm.openrouter_route",
"llm.openrouter_cost",
"llm.openrouter_fallback",
"llm.openrouter_stream",
"llm.openrouter_usage",
"llm.openrouter_compare",
"llm.anthropic_messages",
"llm.anthropic_stream",
"llm.anthropic_tool_use",
"llm.anthropic_files",
"llm.anthropic_batches",
"llm.anthropic_usage",
"llm.anthropic_cache",
"llm.anthropic_health",
"llm.deepseek_chat",
"llm.deepseek_reasoner",
"llm.deepseek_stream",
"llm.deepseek_cost",
"llm.deepseek_health",
"llm.deepseek_usage",
"llm.mistral_chat",
"llm.mistral_stream",
"llm.mistral_embeddings",
"llm.mistral_agents",
"llm.mistral_files",
"llm.mistral_batch",
"llm.mistral_usage",
"llm.groq_chat",
"llm.groq_stream",
"llm.groq_models",
"llm.groq_latency_test",
"llm.groq_usage",
"llm.groq_health",
"llm.together_chat",
"llm.together_stream",
"llm.together_embeddings",
"llm.together_models",
"llm.together_finetune",
"llm.together_usage"
`);

const section6And7Names = parseNameBlock(`
"mcp.server.core.initialize",
"mcp.server.core.shutdown",
"mcp.server.core.restart",
"mcp.server.core.reload",
"mcp.server.core.healthcheck",
"mcp.server.core.self_test",
"mcp.server.core.capabilities",
"mcp.server.core.version",
"mcp.server.core.status",
"mcp.server.core.metrics",
"mcp.server.core.diagnostics",
"mcp.server.core.profile",
"mcp.server.core.optimize",
"mcp.server.core.backup",
"mcp.server.core.restore",
"mcp.server.discover",
"mcp.server.add",
"mcp.server.remove",
"mcp.server.start",
"mcp.server.stop",
"mcp.server.restart",
"mcp.server.healthcheck",
"mcp.server.list_tools",
"mcp.server.list_resources",
"mcp.server.list_prompts",
"mcp.server.refresh_tools",
"mcp.server.schema_snapshot",
"mcp.server.schema_diff",
"mcp.server.permission_audit",
"mcp.server.logs",
"mcp.server.log_tail",
"mcp.server.metrics",
"mcp.server.update",
"mcp.server.version_pin",
"mcp.server.pin_version",
"mcp.server.unpin_version",
"mcp.server.sandbox",
"mcp.server.proxy",
"mcp.server_gateway",
"mcp.server.config.read",
"mcp.server.config.write",
"mcp.server.config.patch",
"mcp.server.config.validate",
"mcp.server.config.diff",
"mcp.server.config.snapshot",
"mcp.server.config.rollback",
"mcp.server.config.reload",
"mcp.server.config.export",
"mcp.server.config.import",
"mcp.server.config.encrypt",
"mcp.server.config.decrypt",
"mcp.server.config.schema_generate",
"mcp.server.config.schema_validate",
"mcp.server.runtime.reload_tools",
"mcp.server.runtime.reload_resources",
"mcp.server.runtime.reload_prompts",
"mcp.server.runtime.reload_policies",
"mcp.server.runtime.reload_models",
"mcp.server.runtime.reload_agents",
"mcp.server.runtime.reload_connectors",
"mcp.server.runtime.reload_plugins",
"mcp.server.runtime.hot_swap_tool",
"mcp.server.runtime.hot_swap_model",
"mcp.server.runtime.hot_swap_policy",
"mcp.server.runtime.hot_swap_router",
"mcp.server.runtime.hot_swap_plugin",
"mcp.server.runtime.live_patch",
"mcp.server.runtime.live_migrate",
"mcp.client.connect",
"mcp.client.disconnect",
"mcp.client.reconnect",
"mcp.client.list_sessions",
"mcp.client.session_create",
"mcp.client.session_restore",
"mcp.client.session_close",
"mcp.client.call_tool",
"mcp.client.read_resource",
"mcp.client.subscribe_resource",
"mcp.client.list_prompts",
"mcp.client.get_prompt",
"mcp.client.trace_call",
"mcp.client.audit_call",
"mcp.client.retry_call",
"mcp.client.timeout_call",
"mcp.client.rate_limit",
"mcp.client.cancel_call",
"mcp.client.result_cache",
"mcp.tool.create",
"mcp.tool.update",
"mcp.tool.delete",
"mcp.tool.enable",
"mcp.tool.disable",
"mcp.tool.rename",
"mcp.tool.clone",
"mcp.tool.wrap",
"mcp.tool.compose",
"mcp.tool.chain",
"mcp.tool.parallelize",
"mcp.tool.batch",
"mcp.tool.stream",
"mcp.tool.cache",
"mcp.tool.rate_limit",
"mcp.tool.timeout",
"mcp.tool.retry",
"mcp.tool.fallback",
"mcp.tool.sandbox",
"mcp.tool.audit",
"mcp.tool.profile",
"mcp.tool.benchmark",
"mcp.tool.test",
"mcp.tool.validate",
"mcp.tool.document",
"mcp.tool.schema.generate",
"mcp.tool.schema.infer",
"mcp.tool.schema.validate",
"mcp.tool.schema.diff",
"mcp.tool.schema.version",
"mcp.tool.schema.migrate",
"mcp.tool.schema.compact",
"mcp.tool.schema.expand",
"mcp.tool.schema.describe",
"mcp.tool.schema.examples_generate",
"mcp.tool.schema.fuzz_test",
"mcp.tool.schema.compatibility_check",
"mcp.tool.schema.deprecation_scan",
"mcp.tool.schema.breaking_change_detect",
"mcp.tool.metadata.generate",
"mcp.tool.metadata.update",
"mcp.tool.metadata.normalize",
"mcp.tool.metadata.enrich",
"mcp.tool.metadata.risk_label",
"mcp.tool.metadata.cost_label",
"mcp.tool.metadata.latency_label",
"mcp.tool.metadata.capability_label",
"mcp.tool.metadata.permission_label",
"mcp.tool.metadata.owner_label",
"mcp.tool.metadata.domain_label",
"mcp.tool.metadata.embedding_create",
"mcp.tool.metadata.semantic_index",
"mcp.tool.metadata.quality_score",
"mcp.tool.registry.create",
"mcp.tool.registry.import",
"mcp.tool.registry.export",
"mcp.tool.registry.search",
"mcp.tool.registry.semantic_search",
"mcp.tool.registry.list",
"mcp.tool.registry.list_all",
"mcp.tool.registry.list_enabled",
"mcp.tool.registry.list_disabled",
"mcp.tool.registry.list_by_capability",
"mcp.tool.registry.list_by_risk",
"mcp.tool.registry.list_by_cost",
"mcp.tool.registry.list_by_latency",
"mcp.tool.registry.list_by_provider",
"mcp.tool.registry.list_by_pack",
"mcp.tool.registry.add",
"mcp.tool.registry.remove",
"mcp.tool.registry.enable",
"mcp.tool.registry.disable",
"mcp.tool.registry.schema_get",
"mcp.tool.registry.schema_validate",
"mcp.tool.registry.capability_map",
"mcp.tool.registry.risk_map",
"mcp.tool.registry.cost_map",
"mcp.tool.registry.latency_map",
"mcp.tool.registry.version_pin",
"mcp.tool.registry.dedupe",
"mcp.tool.registry.merge",
"mcp.tool.registry.split",
"mcp.tool.registry.snapshot",
"mcp.tool.registry.rollback",
"mcp.tool.registry.audit",
"mcp.tool.pack.create",
"mcp.tool.pack.update",
"mcp.tool.pack.delete",
"mcp.tool.pack.clone",
"mcp.tool.pack.compose",
"mcp.tool.pack.split",
"mcp.tool.pack.enable",
"mcp.tool.pack.disable",
"mcp.tool.pack.pin_versions",
"mcp.tool.pack.unpin_versions",
"mcp.tool.pack.security_scan",
"mcp.tool.pack.conflict_scan",
"mcp.tool.pack.resolve_conflicts",
"mcp.tool.pack.benchmark",
"mcp.tool.pack.publish",
"mcp.tool.pack.install",
"mcp.tool.pack.uninstall",
"mcp.tool.router.intent_detect",
"mcp.tool.router.capability_detect",
"mcp.tool.router.context_detect",
"mcp.tool.router.risk_detect",
"mcp.tool.router.cost_detect",
"mcp.tool.router.latency_detect",
"mcp.tool.router.privacy_detect",
"mcp.tool.router.select_candidates",
"mcp.tool.router.select_candidate_tools",
"mcp.tool.router.rank_tools",
"mcp.tool.router.select_best",
"mcp.tool.router.select_best_tool",
"mcp.tool.router.select_chain",
"mcp.tool.router.select_tool_chain",
"mcp.tool.router.select_parallel",
"mcp.tool.router.select_parallel_tools",
"mcp.tool.router.select_fallback_tools",
"mcp.tool.router.simulate_tool_call",
"mcp.tool.router.validate_arguments",
"mcp.tool.router.repair_arguments",
"mcp.tool.router.execute",
"mcp.tool.router.verify_result",
"mcp.tool.router.retry",
"mcp.tool.router.fallback",
"mcp.tool.router.learn_success",
"mcp.tool.router.learn_failure",
"mcp.tool.router.optimize_routing",
"mcp.gateway.start",
"mcp.gateway.stop",
"mcp.gateway.restart",
"mcp.gateway.route",
"mcp.gateway.proxy",
"mcp.gateway.load_balance",
"mcp.gateway.failover",
"mcp.gateway.rate_limit",
"mcp.gateway.auth",
"mcp.gateway.tls",
"mcp.gateway.cors",
"mcp.gateway.webhook",
"mcp.gateway.sse",
"mcp.gateway.websocket",
"mcp.gateway.logs",
"mcp.gateway.metrics",
"mcp.gateway.audit",
"mcp.proxy.create",
"mcp.proxy.update",
"mcp.proxy.delete",
"mcp.proxy.route_tool_call",
"mcp.proxy.route_resource_read",
"mcp.proxy.route_prompt_get",
"mcp.proxy.rewrite_schema",
"mcp.proxy.rewrite_arguments",
"mcp.proxy.redact_inputs",
"mcp.proxy.redact_outputs",
"mcp.proxy.cache_results",
"mcp.proxy.retry",
"mcp.proxy.fallback",
"mcp.proxy.audit",
"mcp.connector.github",
"mcp.connector.gitlab",
"mcp.connector.bitbucket",
"mcp.connector.linear",
"mcp.connector.jira",
"mcp.connector.slack",
"mcp.connector.discord",
"mcp.connector.notion",
"mcp.connector.confluence",
"mcp.connector.google_drive",
"mcp.connector.google_calendar",
"mcp.connector.gmail",
"mcp.connector.outlook",
"mcp.connector.dropbox",
"mcp.connector.box",
"mcp.connector.sharepoint",
"mcp.connector.supabase",
"mcp.connector.postgres",
"mcp.connector.mysql",
"mcp.connector.redis",
"mcp.connector.mongodb",
"mcp.connector.elasticsearch",
"mcp.connector.pinecone",
"mcp.connector.qdrant",
"mcp.connector.weaviate",
"mcp.connector.sentry",
"mcp.connector.datadog",
"mcp.connector.grafana",
"mcp.connector.prometheus",
"mcp.connector.aws",
"mcp.connector.gcp",
"mcp.connector.azure",
"mcp.connector.docker",
"mcp.connector.kubernetes",
"mcp.connector.terraform",
"mcp.connector.stripe",
"mcp.connector.shopify",
"mcp.connector.figma",
"mcp.connector.browser",
"mcp.connector.playwright",
"mcp.connector.firecrawl",
"mcp.connector.exa",
"tool.registry.list",
"tool.registry.search",
"tool.registry.add",
"tool.registry.remove",
"tool.registry.update",
"tool.registry.get_schema",
"tool.registry.get_capabilities",
"tool.registry.get_risk_level",
"tool.registry.get_cost",
"tool.registry.get_required_permissions",
"tool.registry.version_pin",
"tool.registry.version_unpin",
"tool.registry.diff",
"tool.registry.audit",
"tool.registry.create",
"tool.registry.import",
"tool.registry.export",
"tool.registry.list_all",
"tool.registry.list_active",
"tool.registry.activate",
"tool.registry.deactivate",
"tool.registry.enable_pack",
"tool.registry.disable_pack",
"tool.registry.schema_get",
"tool.registry.schema_validate",
"tool.registry.schema_diff",
"tool.registry.capability_map",
"tool.registry.risk_map",
"tool.registry.cost_map",
"tool.registry.owner_map",
"tool.registry.version_update",
"tool_registry.autonomous.import",
"tool_registry.autonomous.export",
"tool_registry.autonomous.search",
"tool_registry.autonomous.semantic_search",
"tool_registry.autonomous.list_all",
"tool_registry.autonomous.list_active",
"tool_registry.autonomous.activate",
"tool_registry.autonomous.deactivate",
"tool_registry.autonomous.activate_by_capability",
"tool_registry.autonomous.deactivate_by_risk",
"tool_registry.autonomous.enable_pack",
"tool_registry.autonomous.disable_pack",
"tool_registry.autonomous.schema_get",
"tool_registry.autonomous.schema_validate",
"tool_registry.autonomous.schema_diff",
"tool_registry.autonomous.capability_map",
"tool_registry.autonomous.risk_map",
"tool_registry.autonomous.cost_map",
"tool_registry.autonomous.latency_map",
"tool_registry.autonomous.success_rate_map",
"tool_registry.autonomous.version_pin",
"tool_registry.autonomous.audit",
"tool.router.plan",
"tool.router.detect_need",
"tool.router.find_candidates",
"tool.router.select",
"tool.router.rank",
"tool.router.rank_candidates",
"tool.router.select_best",
"tool.router.select_safe",
"tool.router.select_fastest",
"tool.router.select_cheapest",
"tool.router.select_verified",
"tool.router.compose",
"tool.router.compose_chain",
"tool.router.compose_parallel",
"tool.router.simulate",
"tool.router.simulate_call",
"tool.router.execute",
"tool.router.execute_call",
"tool.router.verify_result",
"tool.router.verify_output",
"tool.router.retry_call",
"tool.router.fallback",
"tool.router.fallback_call",
"tool.router.learn_from_result",
"tool.router.learn_success",
"tool.router.learn_failure",
"tool.router.explain_choice",
"tool.router.explain_selection",
"tool.router.optimize_future",
"tool_brain.intent_to_tool",
"tool_brain.goal_to_tool_chain",
"tool_brain.task_to_tool_pack",
"tool_brain.context_to_tool_subset",
"tool_brain.model_to_tool_subset",
"tool_brain.risk_to_tool_policy",
"tool_brain.cost_to_tool_policy",
"tool_brain.latency_to_tool_policy",
"tool_brain.privacy_to_tool_policy",
"tool_brain.select_candidate_tools",
"tool_brain.rank_candidate_tools",
"tool_brain.select_best_tool",
"tool_brain.select_best_tool_chain",
"tool_brain.select_best_parallel_tools",
"tool_brain.simulate_tool_call",
"tool_brain.validate_tool_args",
"tool_brain.repair_tool_args",
"tool_brain.execute_tool_call",
"tool_brain.verify_tool_result",
"tool_brain.learn_from_success",
"tool_brain.learn_from_failure",
"tool_brain.optimize_future_selection",
"function_gateway.register_function",
"function_gateway.unregister_function",
"function_gateway.list_functions",
"function_gateway.describe_function",
"function_gateway.generate_schema",
"function_gateway.validate_schema",
"function_gateway.invoke",
"function_gateway.invoke_async",
"function_gateway.invoke_parallel",
"function_gateway.invoke_chain",
"function_gateway.invoke_sandboxed",
"function_gateway.invoke_with_policy",
"function_gateway.invoke_with_approval",
"function_gateway.invoke_with_retry",
"function_gateway.invoke_with_fallback",
"function_gateway.return_result_to_model",
"function_gateway.trace",
"function_gateway.audit",
"server_tool_use.plan",
"server_tool_use.select_tools",
"server_tool_use.send_schemas_to_gemini",
"server_tool_use.send_schemas_to_ollama",
"server_tool_use.receive_function_call",
"server_tool_use.validate_function_call",
"server_tool_use.execute_function_call",
"server_tool_use.stream_tool_result",
"server_tool_use.feed_result_to_model",
"server_tool_use.continue_reasoning",
"server_tool_use.loop_until_done",
"server_tool_use.loop_until_budget",
"server_tool_use.loop_until_risk_gate",
"server_tool_use.persist_trace",
"server_tool_use.finalize"
`);

const allNames = [...section5Names, ...section6And7Names];

function inferProviderFromName(name: string): string {
  if (name.includes('gemini')) return 'gemini';
  if (name.includes('ollama')) return 'ollama';
  if (name.includes('anthropic')) return 'anthropic';
  if (name.includes('openrouter')) return 'openrouter';
  if (name.includes('groq')) return 'groq';
  if (name.includes('mistral')) return 'mistral';
  if (name.includes('deepseek')) return 'deepseek';
  if (name.includes('together')) return 'together';
  if (name.includes('openai')) return 'openai';
  return 'auto';
}

function upsertProvider(providerName: string, updates: Partial<ProviderRecord>): ProviderRecord {
  const current = providers.get(providerName) ?? {
    id: providerName,
    status: 'healthy' as const,
    apiKeyConfigured: false,
    updatedAt: new Date().toISOString(),
  };
  const next: ProviderRecord = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  providers.set(providerName, next);
  return next;
}

function buildGenericState(name: string, input: ToolInput): { id: string; status: string; payload: ToolInput; history: Array<{ action: string; at: string; input: ToolInput }> } {
  const namespaceSeparator = name.lastIndexOf('.');
  const namespace = namespaceSeparator >= 0 ? name.slice(0, namespaceSeparator) : name;
  const action = namespaceSeparator >= 0 ? name.slice(namespaceSeparator + 1) : name;
  const now = new Date().toISOString();
  const existing = genericNamespaceState.get(namespace);
  const state = existing ?? {
    id: `${namespace.replace(/[^a-zA-Z0-9]+/g, '-')}-${Date.now()}-${++sequence}`,
    payload: {},
    history: [],
  };
  state.payload = { ...state.payload, ...input };
  state.history.push({ action, at: now, input: { ...input } });
  genericNamespaceState.set(namespace, state);
  return {
    ...state,
    status: /(shutdown|stop|cancel|disable|remove|delete|unregister|deactivate)/.test(action)
      ? 'stopped'
      : /(health|status|metrics|usage|list|audit|check|validate|inspect|describe)/.test(action)
        ? 'observed'
        : /(finalize|complete|done)/.test(action)
          ? 'completed'
          : /(pause|sleep)/.test(action)
            ? 'paused'
            : 'running',
  };
}

function pickModel(task?: string): { primary: string; fallback: string } {
  const lower = (task ?? '').toLowerCase();
  if (lower.includes('multimodal') || lower.includes('video') || lower.includes('image')) {
    return { primary: 'gemini-2.5-pro', fallback: 'gpt-4o' };
  }
  if (lower.includes('cost') || lower.includes('cheap')) {
    return { primary: 'gpt-4o-mini', fallback: 'llama3.1:8b' };
  }
  if (lower.includes('privacy') || lower.includes('local')) {
    return { primary: 'llama3.1:8b', fallback: 'gemini-2.5-flash' };
  }
  return { primary: 'gemini-2.5-pro', fallback: 'gpt-4o' };
}

function handleCloudAndModels(name: string, input: ToolInput): Record<string, unknown> {
  const provider = inferProviderFromName(name);
  const now = new Date().toISOString();

  if (name.startsWith('cloud_agent.') && (name.includes('.spawn') || name.includes('spawn_') || name === 'cloud_agent.spawn')) {
    const id = (typeof input.agent_id === 'string' ? input.agent_id : undefined) ?? `cloud-agent-${Date.now()}-${++sequence}`;
    const record: CloudAgentRecord = {
      id,
      provider,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      payload: { ...input, provider },
    };
    cloudAgents.set(id, record);
    return { cloud_agent_id: id, provider, status: record.status, created_at: record.createdAt };
  }

  if (name.startsWith('cloud_agent.') && (name.endsWith('.pause') || name.endsWith('.resume') || name.endsWith('.cancel') || name.endsWith('.shutdown'))) {
    const id = (typeof input.cloud_agent_id === 'string' ? input.cloud_agent_id : undefined) ?? Array.from(cloudAgents.keys())[0];
    if (id && cloudAgents.has(id)) {
      const existing = cloudAgents.get(id)!;
      existing.updatedAt = now;
      existing.status = name.endsWith('.pause') ? 'paused' : name.endsWith('.resume') ? 'running' : 'stopped';
      return { cloud_agent_id: id, provider: existing.provider, status: existing.status, updated_at: now };
    }
    return { cloud_agent_id: id, status: 'not_found' };
  }

  if (name === 'cloud_agent.result') {
    const latest = Array.from(cloudAgents.values()).at(-1);
    return {
      cloud_agent_id: latest?.id ?? null,
      status: latest?.status ?? 'idle',
      result: {
        summary: 'Cloud agent run completed with aggregated findings',
        findings_count: latest ? 1 : 0,
      },
    };
  }

  if (name === 'model.list') {
    return { models: modelCatalog, count: modelCatalog.length };
  }

  if (name === 'model.capabilities') {
    return {
      capabilities: modelCatalog.map((m) => ({ model: m.id, capabilities: m.capabilities })),
    };
  }

  if (name === 'model.pick_for_task' || name.startsWith('model.router.') || name.startsWith('model_router.smart.')) {
    const task = typeof input.task === 'string' ? input.task : typeof input.prompt === 'string' ? input.prompt : '';
    const picked = pickModel(task);
    return {
      task,
      selected_model: picked.primary,
      fallback_model: picked.fallback,
      provider: inferProviderFromName(picked.primary),
      reasoning: 'Selected by heuristic routing (task/cost/privacy/context hints).',
    };
  }

  if (name === 'model.provider.add' || name === 'openai_compatible.provider.add') {
    const providerName = typeof input.provider === 'string' ? input.provider : provider;
    const record = upsertProvider(providerName, {
      endpoint: typeof input.endpoint === 'string' ? input.endpoint : undefined,
      status: 'healthy',
      apiKeyConfigured: typeof input.api_key === 'string' || typeof input.apiKey === 'string',
    });
    return { success: true, provider: record };
  }

  if (name === 'model.provider.remove' || name === 'openai_compatible.provider.remove') {
    const providerName = typeof input.provider === 'string' ? input.provider : provider;
    const removed = providers.delete(providerName);
    return { success: removed, provider: providerName };
  }

  if (name === 'model.provider.list') {
    return { providers: Array.from(providers.values()), count: providers.size };
  }

  if (name.includes('provider_healthcheck') || name.endsWith('.healthcheck') || name.endsWith('_health')) {
    const providerName = typeof input.provider === 'string' ? input.provider : provider;
    const current = providers.get(providerName) ?? upsertProvider(providerName, {});
    return { provider: providerName, healthy: current.status === 'healthy', status: current.status, checked_at: now };
  }

  if (name.endsWith('.models') || name.endsWith('.model_list') || name.endsWith('.models_list')) {
    return { models: modelCatalog.filter((m) => m.provider === provider || provider === 'auto'), provider, count: modelCatalog.length };
  }

  if (name.includes('usage')) {
    return { provider, usage: { requests: 0, tokens_in: 0, tokens_out: 0, cost_estimate: 0 }, timestamp: now };
  }

  if (name.includes('cost')) {
    return { provider, estimated_cost: 0, currency: 'USD', timestamp: now };
  }

  if (name.includes('stream')) {
    return { provider, stream: { enabled: true, chunks_emitted: 1, preview: 'streaming response simulated' } };
  }

  if (name.includes('embed')) {
    return { provider, embedding: [0.11, 0.22, 0.33], dimensions: 3 };
  }

  if (name.includes('count_tokens')) {
    const text = typeof input.text === 'string' ? input.text : typeof input.prompt === 'string' ? input.prompt : '';
    return { provider, tokens: Math.ceil(text.length / 4), chars: text.length };
  }

  if (name.includes('chat') || name.includes('generate') || name.includes('call') || name.includes('responses')) {
    const prompt = typeof input.prompt === 'string' ? input.prompt : typeof input.message === 'string' ? input.message : '';
    const picked = pickModel(prompt);
    return {
      provider,
      model: picked.primary,
      output: `Simulated response from ${picked.primary}`,
      prompt_preview: prompt.slice(0, 120),
      timestamp: now,
    };
  }

  return {};
}

function handleMcpAndTooling(name: string, input: ToolInput): Record<string, unknown> {
  const now = new Date().toISOString();
  if (name === 'mcp.server.add') {
    const serverId = typeof input.id === 'string' ? input.id : `mcp-server-${Date.now()}-${++sequence}`;
    const record: McpServerRecord = {
      id: serverId,
      url: typeof input.url === 'string' ? input.url : config.auth.remoteProfiles.primusnex.mcpUrl,
      status: 'configured',
      auth: {
        mode: typeof input.auth_mode === 'string' ? input.auth_mode : 'api-key',
        header: typeof input.header === 'string' ? input.header : typeof input.auth_header === 'string' ? input.auth_header : 'x-api-key',
        bearer: input.bearer !== false,
        basic: input.basic === true,
        oauth: {
          authorizationUrl: typeof input.authorization_url === 'string' ? input.authorization_url : typeof input.oauth_authorization_url === 'string' ? input.oauth_authorization_url : undefined,
          tokenUrl: typeof input.token_url === 'string' ? input.token_url : typeof input.oauth_token_url === 'string' ? input.oauth_token_url : undefined,
          clientIdConfigured: typeof input.client_id === 'string' && input.client_id.length > 0,
          clientSecretConfigured: typeof input.client_secret === 'string' && input.client_secret.length > 0,
        },
      },
      capabilities: ['tools', 'resources', 'prompts'],
      updatedAt: now,
    };
    mcpServers.set(serverId, record);
    return {
      success: true,
      server: record,
      note: 'Secrets are accepted at runtime but never echoed back.',
    };
  }

  if (name === 'mcp.server.remove') {
    const serverId = typeof input.id === 'string' ? input.id : typeof input.server_id === 'string' ? input.server_id : '';
    return { success: mcpServers.delete(serverId), server_id: serverId };
  }

  if (name === 'mcp.server.start' || name === 'mcp.server.stop' || name === 'mcp.server.restart') {
    const serverId = typeof input.id === 'string' ? input.id : typeof input.server_id === 'string' ? input.server_id : Array.from(mcpServers.keys())[0];
    const server = serverId ? mcpServers.get(serverId) : undefined;
    if (!server) {
      return { success: false, error: 'server_not_found', server_id: serverId };
    }
    server.status = name.endsWith('.stop') ? 'stopped' : 'running';
    server.updatedAt = now;
    return { success: true, server };
  }

  if (name === 'mcp.server.discover') {
    return {
      servers: Array.from(mcpServers.values()),
      count: mcpServers.size,
    };
  }

  if (name === 'mcp.server.config.read') {
    const serverId = typeof input.id === 'string' ? input.id : typeof input.server_id === 'string' ? input.server_id : Array.from(mcpServers.keys())[0];
    const server = serverId ? mcpServers.get(serverId) : undefined;
    if (!server) {
      return { success: false, error: 'server_not_found', server_id: serverId };
    }
    return {
      success: true,
      config: server,
    };
  }

  if (name === 'mcp.server.config.write' || name === 'mcp.server.config.patch') {
    const serverId = typeof input.id === 'string' ? input.id : typeof input.server_id === 'string' ? input.server_id : Array.from(mcpServers.keys())[0];
    const server = serverId ? mcpServers.get(serverId) : undefined;
    if (!server) {
      return { success: false, error: 'server_not_found', server_id: serverId };
    }
    if (typeof input.url === 'string') {
      server.url = input.url;
    }
    if (typeof input.auth_mode === 'string') {
      server.auth.mode = input.auth_mode;
    }
    if (typeof input.auth_header === 'string' || typeof input.header === 'string') {
      server.auth.header = (typeof input.auth_header === 'string' ? input.auth_header : input.header) as string;
    }
    server.updatedAt = now;
    return { success: true, config: server };
  }

  if (name === 'mcp.server.list_tools') {
    const names = getToolNames();
    return {
      tools: names,
      count: names.length,
      remote_servers: Array.from(mcpServers.values()).map((server) => ({ id: server.id, url: server.url, status: server.status })),
    };
  }

  if (name === 'mcp.server.list_resources') {
    return {
      resources: Array.from(mcpServers.values()).map((server) => ({
        server_id: server.id,
        uri: `${server.url}#tools`,
        auth_mode: server.auth.mode,
      })),
    };
  }

  if (name === 'mcp.server.list_prompts') {
    return {
      prompts: Array.from(mcpServers.values()).map((server) => ({
        server_id: server.id,
        name: `${server.id}.default`,
        description: `Default prompt catalog for ${server.id}`,
      })),
    };
  }

  if (name === 'mcp.server.healthcheck' || name === 'mcp.server.core.healthcheck' || name === 'mcp.gateway.metrics') {
    return {
      healthy: true,
      timestamp: now,
      registered_tools: getToolNames().length,
      servers: Array.from(mcpServers.values()).map((server) => ({
        id: server.id,
        status: server.status,
        auth_mode: server.auth.mode,
      })),
    };
  }

  if (name === 'mcp.client.connect' || name === 'mcp.client.session_create') {
    const id = (typeof input.session_id === 'string' ? input.session_id : undefined) ?? `mcp-session-${Date.now()}-${++sequence}`;
    const session: SessionRecord = { id, status: 'connected', updatedAt: now };
    mcpClientSessions.set(id, session);
    return { success: true, session };
  }

  if (name === 'mcp.client.disconnect' || name === 'mcp.client.session_close') {
    const id = typeof input.session_id === 'string' ? input.session_id : Array.from(mcpClientSessions.keys())[0];
    if (!id || !mcpClientSessions.has(id)) return { success: false, session_id: id, error: 'session_not_found' };
    const session = mcpClientSessions.get(id)!;
    session.status = 'disconnected';
    session.updatedAt = now;
    return { success: true, session };
  }

  if (name === 'mcp.client.list_sessions') {
    return { sessions: Array.from(mcpClientSessions.values()), count: mcpClientSessions.size };
  }

  if (name.startsWith('mcp.tool.registry.') || name.startsWith('mcp.tool.pack.')) {
    return {
      success: true,
      state_size: toolRegistryState.size,
      known_tools: getToolNames().length,
      timestamp: now,
    };
  }

  if (name.startsWith('mcp.connector.')) {
    return {
      connector: name.replace('mcp.connector.', ''),
      status: 'configured',
      connected: false,
      timestamp: now,
    };
  }

  if (name.startsWith('mcp.gateway.') || name.startsWith('mcp.proxy.')) {
    return { success: true, route_active: true, timestamp: now };
  }

  return {};
}

function handleToolBrainAndGateway(name: string, input: ToolInput): Record<string, unknown> {
  const now = new Date().toISOString();
  if (name === 'function_gateway.register_function') {
    const functionName = typeof input.name === 'string' ? input.name : `function-${Date.now()}-${++sequence}`;
    const record: FunctionRecord = {
      name: functionName,
      schema: input.schema,
      metadata: input,
      updatedAt: now,
    };
    functionRegistry.set(functionName, record);
    return { success: true, function: record };
  }

  if (name === 'function_gateway.unregister_function') {
    const functionName = typeof input.name === 'string' ? input.name : '';
    return { success: functionRegistry.delete(functionName), name: functionName };
  }

  if (name === 'function_gateway.list_functions') {
    return { functions: Array.from(functionRegistry.values()), count: functionRegistry.size };
  }

  if (name.startsWith('function_gateway.invoke')) {
    const functionName = typeof input.name === 'string' ? input.name : Array.from(functionRegistry.keys())[0];
    return {
      invoked: functionName ?? null,
      success: Boolean(functionName),
      result: { echoed_input: input, timestamp: now },
    };
  }

  if (name.startsWith('tool.registry.') || name.startsWith('tool_registry.autonomous.')) {
    if (name.endsWith('.add') || name.endsWith('.activate') || name.endsWith('.import')) {
      const key = typeof input.tool === 'string' ? input.tool : typeof input.name === 'string' ? input.name : `tool-${Date.now()}-${++sequence}`;
      toolRegistryState.set(key, { ...input, updated_at: now });
      return { success: true, key, size: toolRegistryState.size };
    }

    if (name.endsWith('.remove') || name.endsWith('.deactivate')) {
      const key = typeof input.tool === 'string' ? input.tool : typeof input.name === 'string' ? input.name : '';
      return { success: toolRegistryState.delete(key), key, size: toolRegistryState.size };
    }

    if (name.includes('list')) {
      return { tools: Array.from(toolRegistryState.entries()).map(([k, v]) => ({ name: k, metadata: v })), count: toolRegistryState.size };
    }
  }

  if (name.startsWith('tool.router.') || name.startsWith('tool_brain.')) {
    const available = getToolNames();
    return {
      selected_tools: available.slice(0, Math.min(5, available.length)),
      rationale: 'Selected by lightweight routing heuristic over registered tool inventory.',
      timestamp: now,
    };
  }

  if (name.startsWith('server_tool_use.')) {
    return {
      loop_state: /(loop_until_)/.test(name) ? 'running' : 'ready',
      trace_id: `trace-${Date.now()}-${++sequence}`,
      success: true,
    };
  }

  return {};
}

function registerExtendedTool(name: string): void {
  if (getTool(name)) return;

  const category = name.startsWith('mcp.')
    ? 'mcp'
    : name.startsWith('tool.') || name.startsWith('tool_') || name.startsWith('function_gateway') || name.startsWith('server_tool_use')
      ? 'tooling'
      : 'ai';

  registerTool({
    name,
    description: `Extended MCP tool for ${name}`,
    category,
    schema: genericSchema,
    handler: async (rawInput) => {
      const input = rawInput as ToolInput;
      const base = buildGenericState(name, input);
      const cloudPayload = handleCloudAndModels(name, input);
      const mcpPayload = handleMcpAndTooling(name, input);
      const toolingPayload = handleToolBrainAndGateway(name, input);

      return {
        success: true,
        tool: name,
        category,
        state_id: base.id,
        state_status: base.status,
        operations: base.history.length,
        timestamp: new Date().toISOString(),
        ...cloudPayload,
        ...mcpPayload,
        ...toolingPayload,
        payload: Object.keys(cloudPayload).length || Object.keys(mcpPayload).length || Object.keys(toolingPayload).length
          ? undefined
          : base.payload,
      };
    },
  });
}

for (const name of allNames) {
  registerExtendedTool(name);
}
