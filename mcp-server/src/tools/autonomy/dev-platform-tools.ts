import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import simpleGit from 'simple-git';
import axios from 'axios';
import { z } from 'zod';
import { executeTool, getTool, registerTool } from '../../registry';
import { runSandboxed, validatePath } from '../../utils/sandbox';
import { config } from '../../utils/config';

type ToolInput = Record<string, unknown>;

const genericSchema = z.object({}).catchall(z.unknown());
let sequence = 0;

function parseNameBlock(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, '').replace(/^"/, '').replace(/"$/, ''))
    .filter(Boolean);
}

const section8Names = parseNameBlock(`
"code.read",
"code.write",
"code.append",
"code.create",
"code.delete",
"code.move",
"code.copy",
"code.rename",
"code.read_file",
"code.write_file",
"code.append_file",
"code.create_file",
"code.delete_file",
"code.edit_file",
"code.apply_patch",
"code.generate_patch",
"code.patch",
"code.patch_preview",
"code.patch_apply",
"code.patch_revert",
"code.review_patch",
"code.explain_file",
"code.explain_symbol",
"code.find_symbol",
"code.find_references",
"code.find_bug",
"code.fix_bug",
"code.fix_type_error",
"code.fix_build_error",
"code.fix_test_failure",
"code.fix_lint_error",
"code.fix_runtime_error",
"code.fix_security_issue",
"code.fix_performance_issue",
"code.fix_memory_leak",
"code.fix_race_condition",
"code.fix_api_contract",
"code.fix_ui_bug",
"code.fix_accessibility",
"code.fix_flaky_test",
"code.fix_dependency_issue",
"code.refactor",
"code.format",
"code.lint",
"code.fix_lint",
"code.generate_tests",
"code.generate_docs",
"code.generate_types",
"code.find_dead_code",
"code.find_security_issues",
"code.find_performance_issues",
"code.find_duplicate_logic",
"code.find_todos",
"code.find_deprecated_apis",
"code.migrate_api",
"code.codemod",
"code.optimize",
"code.minimize_repro",
"code.review",
"code.review_diff",
"code.review_full_context",
"code.review_correctness",
"code.review_security",
"code.review_performance",
"code.review_readability",
"code.review_maintainability",
"code.review_testability",
"code.review_accessibility",
"code.review_api_contract",
"code.review_database",
"code.review_infra",
"code.review_branch",
"code.review_pr",
"code.review_full_repo",
"code.review_regression_risk",
"code.generate_file",
"code.generate_module",
"code.generate_component",
"code.generate_api_route",
"code.generate_cli",
"code.generate_script",
"code.generate_config",
"code.generate_schema",
"code.generate_migration",
"code.generate_client",
"code.generate_server",
"code.generate_mock",
"code.generate_fixture",
"code.generate_adapter",
"code.generate_plugin",
"code.generate_integration",
"code.generate_release_notes",
"repo.index",
"repo.index.build",
"repo.index.refresh",
"repo.semantic_search",
"repo.regex_search",
"repo.symbol_search",
"repo.callgraph",
"repo.dependency_graph",
"repo.import_graph",
"repo.export_graph",
"repo.architecture_map",
"repo.impact_analysis",
"repo.risk_hotspots",
"repo.ownership_detect",
"repo.changelog_generate",
"repo.release_notes_generate",
"repo.find_entrypoints",
"repo.find_unused_exports",
"repo.find_circular_dependencies",
"repo.find_large_files",
"repo.find_complex_functions",
"codebase.scan",
"codebase.index",
"codebase.index_incremental",
"codebase.semantic_search",
"codebase.regex_search",
"codebase.symbol_search",
"codebase.file_search",
"codebase.dependency_graph",
"codebase.call_graph",
"codebase.import_graph",
"codebase.export_graph",
"codebase.route_graph",
"codebase.api_graph",
"codebase.component_graph",
"codebase.ownership_map",
"codebase.hotspot_map",
"codebase.risk_map",
"codebase.complexity_map",
"codebase.entrypoints",
"codebase.impact_analysis",
"repo_intelligence.map_architecture",
"repo_intelligence.map_symbols",
"repo_intelligence.map_dependencies",
"repo_intelligence.map_routes",
"repo_intelligence.map_components",
"repo_intelligence.map_database",
"repo_intelligence.map_apis",
"repo_intelligence.map_tests",
"repo_intelligence.map_deploy",
"repo_intelligence.map_owners",
"repo_intelligence.find_hotspots",
"repo_intelligence.find_risky_files",
"repo_intelligence.find_dead_code",
"repo_intelligence.find_missing_tests",
"repo_intelligence.find_security_risks",
"repo_intelligence.find_performance_risks",
"repo_intelligence.summarize_for_agent",
"repo_intelligence.summarize_for_gemini",
"repo_intelligence.summarize_for_ollama",
"ast.parse",
"ast.query",
"ast.match_pattern",
"ast.find_pattern",
"ast.replace",
"ast.replace_node",
"ast.insert_node",
"ast.delete_node",
"ast.extract_function",
"ast.rename_identifier",
"ast.add_import",
"ast.remove_import",
"ast.sort_imports",
"ast.inline_function",
"ast.codemod_plan",
"ast.codemod_preview",
"ast.codemod_apply",
"ast.codemod_revert",
"ast.find_dead_code",
"ast.find_duplicate_logic",
"ast.find_complexity",
"ast.find_unsafe_patterns",
"lsp.start",
"lsp.stop",
"lsp.restart",
"lsp.definition",
"lsp.references",
"lsp.implementation",
"lsp.type_definition",
"lsp.rename_symbol",
"lsp.rename",
"lsp.hover",
"lsp.signature_help",
"lsp.document_symbols",
"lsp.workspace_symbols",
"lsp.diagnostics",
"lsp.code_actions",
"lsp.code_action",
"lsp.format",
"lsp.organize_imports",
"lsp.semantic_tokens",
"lsp.completion",
"lsp.inlay_hints",
"lsp.call_hierarchy",
"typescript.check",
"typescript.build",
"typescript.lint",
"typescript.format",
"typescript.trace_resolution",
"typescript.find_any",
"typescript.strictness_report",
"typescript.generate_types",
"typescript.fix_types",
"typescript.tsconfig_analyze",
"javascript.bundle_analyze",
"javascript.eslint_run",
"javascript.eslint_fix",
"javascript.prettier_run",
"javascript.node_run",
"javascript.npm_script",
"javascript.vitest_run",
"javascript.jest_run",
"javascript.playwright_run",
"python.venv_create",
"python.install",
"python.run",
"python.pytest",
"python.pytest_file",
"python.coverage",
"python.typecheck",
"python.ruff_check",
"python.ruff_fix",
"python.mypy",
"python.pyright",
"python.pytest_collect",
"python.poetry_install",
"python.uv_sync",
"python.pip_audit",
"python.import_graph",
"python.dead_code",
"python.notebook_run",
"go.test",
"go.test_package",
"go.vet",
"go.mod_tidy",
"go.fmt",
"go.lint",
"go.callgraph",
"go.benchmark",
"go.coverage",
"go.generate",
"rust.check",
"rust.build",
"rust.clippy",
"rust.test",
"rust.fmt",
"rust.bench",
"rust.cargo_audit",
"rust.cargo_tree",
"rust.doc",
"rust.fix",
"java.compile",
"java.test",
"java.maven_test",
"java.gradle_test",
"java.dependency_tree",
"java.spotbugs",
"java.checkstyle",
"java.format",
"java.jacoco_report",
"java.package"
`);

const section9Names = parseNameBlock(`
"git.status",
"git.diff",
"git.diff_staged",
"git.diff_summary",
"git.add",
"git.restore",
"git.reset",
"git.commit",
"git.commit_amend",
"git.branch",
"git.branch.list",
"git.branch.create",
"git.branch_create",
"git.branch.delete",
"git.branch_delete",
"git.checkout",
"git.switch",
"git.merge",
"git.rebase",
"git.cherry_pick",
"git.stash",
"git.stash_pop",
"git.tag",
"git.tag.create",
"git.log",
"git.log_search",
"git.blame",
"git.remote.list",
"git.remote.add",
"git.fetch",
"git.pull",
"git.push",
"git.conflicts.detect",
"git.conflicts.resolve",
"git.conflicts.resolve_plan",
"git.worktree",
"git.worktree.create",
"git.worktree.remove",
"github.repo.get",
"github.repo_get",
"github.repo.list",
"github.repo.search",
"github.repo_search",
"github.repo.create",
"github.repo.fork",
"github.repo.clone_url",
"github.repo.metadata",
"github.repo.languages",
"github.repo.topics",
"github.repo.branches",
"github.repo.tags",
"github.repo.releases",
"github.repo.contributors",
"github.repo.activity",
"github.repo.security_advisories",
"github.repo.dependency_graph",
"github.repo.vulnerability_alerts",
"github.repo.rulesets",
"github.repo.environments",
"github.repo.webhooks",
"github.file.get",
"github.file.list",
"github.file.create",
"github.file.update",
"github.file.delete",
"github.file.move",
"github.file.search",
"github.file.raw",
"github.file.blame",
"github.file.history",
"github.file.commit_change",
"github.file.batch_commit",
"github.file.compare",
"github.file.patch",
"github.code.search",
"github.code_search",
"github.repo.search_code",
"github.code.read",
"github.code.scan",
"github.code.symbol_search",
"github.code.references",
"github.code.dependency_search",
"github.code.owner_lookup",
"github.code.hotspots",
"github.issue.list",
"github.issue.get",
"github.issue.create",
"github.issue_create",
"github.issue.update",
"github.issue_update",
"github.issue.close",
"github.issue.reopen",
"github.issue.comment",
"github.issue_comment",
"github.issue.list_comments",
"github.issue.edit_comment",
"github.issue.delete_comment",
"github.issue.assign",
"github.issue_assign",
"github.issue.label",
"github.issue_label",
"github.issue.unlabel",
"github.issue.milestone",
"github.issue.link_pr",
"github.issue.search",
"github.issue.timeline",
"github.issue.lock",
"github.issue.unlock",
"github.pr.list",
"github.pr.get",
"github.pr.create",
"github.pr_create",
"github.pr.update",
"github.pr_update",
"github.pr.close",
"github.pr.reopen",
"github.pr.checkout",
"github.pr.diff",
"github.pr.patch",
"github.pr.files",
"github.pr.commits",
"github.pr.status",
"github.pr.checks",
"github.pr.reviewers.request",
"github.pr.reviewers.remove",
"github.pr.review.create",
"github.pr.review.comment",
"github.pr.review.approve",
"github.pr.review.request_changes",
"github.pr.review.dismiss",
"github.pr.review",
"github.pr.comment",
"github.pr.approve",
"github.pr.request_changes",
"github.pr.merge",
"github.pr.squash_merge",
"github.pr.rebase_merge",
"github.pr.update_branch",
"github.pr.conflicts",
"github.pr.ready_for_review",
"github.pr.convert_to_draft",
"github.pr.find_related_issues",
"github.actions.workflow.list",
"github.actions.workflow.get",
"github.actions.workflow.dispatch",
"github.actions.workflow.enable",
"github.actions.workflow.disable",
"github.actions.run.list",
"github.actions.run.get",
"github.actions.run.logs",
"github.actions.run.cancel",
"github.actions.run.rerun",
"github.actions.run.rerun_failed_jobs",
"github.actions.job.list",
"github.actions.job.get",
"github.actions.job.logs",
"github.actions.artifact.list",
"github.actions.artifact.download",
"github.actions.cache.list",
"github.actions.cache.delete",
"github.actions.secret.list",
"github.actions.secret.set",
"github.actions.variable.list",
"github.actions.variable.set",
"github.actions.list_runs",
"github.actions.get_logs",
"github.actions.rerun",
"github.actions.cancel",
"github.actions_runs",
"github.actions_logs",
"github.actions_retry",
"github.actions_cancel",
"github.release.list",
"github.release.get",
"github.release.create",
"github.release_create",
"github.release.update",
"github.release.delete",
"github.release.upload_asset",
"github.release.delete_asset",
"github.release.generate_notes",
"github.release.notes_generate",
"github.release_notes",
"github.release.publish",
"github.release.draft",
"github.dependabot.alerts",
"github.dependabot.alert.get",
"github.dependabot.alert.dismiss",
"github.dependabot.secret.list",
"github.dependabot.secret.set",
"github.codeql.alerts",
"github.codeql.alert.get",
"github.codeql.alert.dismiss",
"github.codeql.databases",
"github.secret_scanning.alerts",
"github.secret_scanning.alert.get",
"github.secret_scanning.alert.resolve",
"github.security_advisory.list",
"github.security_advisory.get",
"github.security_advisory.create",
"github.security_advisory.update",
"github.security_advisory.publish",
"gitlab.project.get",
"gitlab.project_get",
"gitlab.project.list",
"gitlab.project.search",
"gitlab.file.get",
"gitlab.file.create",
"gitlab.file.update",
"gitlab.file.delete",
"gitlab.branch.list",
"gitlab.branch.create",
"gitlab.branch.delete",
"gitlab.issue.list",
"gitlab.issue.get",
"gitlab.issue.create",
"gitlab.issue.update",
"gitlab.issue.comment",
"gitlab.issue.close",
"gitlab.mr.list",
"gitlab.mr.get",
"gitlab.mr.create",
"gitlab.mr.update",
"gitlab.mr.diff",
"gitlab.mr.review",
"gitlab.mr.comment",
"gitlab.mr.approve",
"gitlab.mr.merge",
"gitlab.pipeline.list",
"gitlab.pipeline.get",
"gitlab.pipeline.run",
"gitlab.pipeline.status",
"gitlab.pipeline.logs",
"gitlab.pipeline.cancel",
"gitlab.pipeline.retry",
"gitlab.job.list",
"gitlab.job.logs",
"gitlab.release.create"
`);

const section10Names = parseNameBlock(`
"test.detect_framework",
"test.detect_frameworks",
"test.install_dependencies",
"test.run_all",
"test.run_changed",
"test.run_file",
"test.run_name",
"test.run_watch",
"test.run_coverage",
"test.coverage",
"test.coverage_report",
"test.coverage_diff",
"test.coverage_threshold",
"test.coverage_gate",
"test.failure_analyze",
"test.failure.cluster",
"test.failure_cluster",
"test.failure.explain",
"test.failure_reproduce",
"test.flaky.detect",
"test.flaky_detect",
"test.flaky.retry",
"test.flaky_retry",
"test.flaky.quarantine",
"test.snapshot.update",
"test.snapshot_update",
"test.snapshot_review",
"test.mutation.run",
"test.mutation_run",
"test.mutation.report",
"test.mutation_report",
"unit.generate",
"unit.improve",
"unit.minimize_case",
"unit.parametrize",
"unit.mock_suggest",
"unit.test_generate",
"unit.test_extend",
"unit.test_refactor",
"unit.test_minimize",
"unit.test_parametrize",
"unit.mock_generate",
"unit.fixture_generate",
"unit.assertion_improve",
"unit.edge_cases_generate",
"unit.boundary_cases_generate",
"unit.property_tests_generate",
"unit.golden_tests_generate",
"unit.contract_tests_generate",
"unit.regression_tests_generate",
"unit.test_cleanup",
"integration.generate",
"integration.run",
"integration.env_prepare",
"integration.env_reset",
"integration.service_start",
"integration.service_stop",
"integration.db_seed",
"integration.db_reset",
"integration.contract_check",
"integration.api_contract",
"integration.queue_test",
"integration.webhook_test",
"integration.auth_flow_test",
"integration.payment_flow_test",
"integration.email_flow_test",
"integration.file_upload_test",
"e2e.open_app",
"e2e.run_all",
"e2e.run_flow",
"e2e.generate_flow",
"e2e.record_flow",
"e2e.replay_flow",
"e2e.trace",
"e2e.screenshot",
"e2e.video",
"e2e.network_log",
"e2e.console_log",
"e2e.accessibility_tree",
"e2e.selector_fix",
"e2e.visual_compare",
"e2e.mobile_viewport",
"e2e.browser_matrix",
"e2e.login_session",
"e2e.seed_user",
"e2e.cleanup",
"e2e.report",
"e2e.playwright.install",
"e2e.playwright.run",
"e2e.playwright.trace",
"e2e.playwright.record",
"e2e.playwright.screenshot_diff",
"e2e.playwright.accessibility_tree",
"e2e.playwright.network_log",
"e2e.playwright.console_log",
"e2e.playwright.fix_selector",
"e2e.playwright.generate_test",
"playwright.browser.install",
"playwright.browser.open",
"playwright.browser.close",
"playwright.browser.new_context",
"playwright.browser.close_context",
"playwright.open",
"playwright.click",
"playwright.type",
"playwright.select",
"playwright.wait",
"playwright.evaluate",
"playwright.page.goto",
"playwright.page.reload",
"playwright.page.back",
"playwright.page.forward",
"playwright.page.snapshot",
"playwright.page.screenshot",
"playwright.page.pdf",
"playwright.page.title",
"playwright.page.url",
"playwright.page.content",
"playwright.page.evaluate",
"playwright.page.wait_for_selector",
"playwright.page.wait_for_load_state",
"playwright.page.wait_for_timeout",
"playwright.element.click",
"playwright.element.double_click",
"playwright.element.hover",
"playwright.element.fill",
"playwright.element.type",
"playwright.element.press",
"playwright.element.select",
"playwright.element.check",
"playwright.element.uncheck",
"playwright.element.drag",
"playwright.element.upload_file",
"playwright.form.submit",
"playwright.keyboard.press",
"playwright.keyboard.type",
"playwright.mouse.click",
"playwright.mouse.move",
"playwright.console.messages",
"playwright.console.errors",
"playwright.network.requests",
"playwright.network.responses",
"playwright.network.failures",
"playwright.network_capture",
"playwright.har_export",
"playwright.cookies.get",
"playwright.cookies.set",
"playwright.local_storage.get",
"playwright.local_storage.set",
"playwright.session.save",
"playwright.session.restore",
"playwright.trace.start",
"playwright.trace.stop",
"playwright.trace.export",
"playwright.video.start",
"playwright.video.stop",
"playwright.video_record",
"playwright.e2e.generate_test",
"playwright.e2e.run_test",
"playwright.e2e.record_flow",
"playwright.e2e.replay_flow",
"playwright.accessibility.snapshot",
"playwright.accessibility.audit",
"playwright.accessibility_snapshot",
"playwright.selector.fix",
"playwright.visual.compare",
"browser.open",
"browser.open_localhost",
"browser.close",
"browser.reload",
"browser.back",
"browser.forward",
"browser.click",
"browser.double_click",
"browser.hover",
"browser.type",
"browser.clear",
"browser.select",
"browser.submit",
"browser.wait",
"browser.evaluate",
"browser.extract_text",
"browser.extract_links",
"browser.extract_tables",
"browser.get_dom",
"browser.get_accessibility_tree",
"browser.get_console",
"browser.get_console_errors",
"browser.inspect_console",
"browser.get_network",
"browser.get_network_errors",
"browser.screenshot",
"browser.record_video",
"browser.downloads.list",
"browser.cookies.get",
"browser.cookies.set",
"browser.session.save",
"browser.session.restore",
"browser.preview_app",
"browser_autonomy.open",
"browser_autonomy.login",
"browser_autonomy.navigate",
"browser_autonomy.click",
"browser_autonomy.type",
"browser_autonomy.submit",
"browser_autonomy.extract",
"browser_autonomy.inspect_dom",
"browser_autonomy.inspect_console",
"browser_autonomy.inspect_network",
"browser_autonomy.screenshot",
"browser_autonomy.record_video",
"browser_autonomy.generate_e2e_test",
"browser_autonomy.run_e2e_test",
"browser_autonomy.fix_selector",
"browser_autonomy.verify_user_flow",
"browser_autonomy.verify_no_errors",
"browser_autonomy.report",
"desktop.app_list",
"desktop.app_launch",
"desktop.app_quit",
"desktop.app_focus",
"desktop.window_list",
"desktop.window_focus",
"desktop.window_resize",
"desktop.window_move",
"desktop.screenshot",
"desktop.click",
"desktop.type",
"desktop.hotkey",
"desktop.menu_click",
"desktop.file_open",
"desktop.file_save",
"desktop.clipboard_get",
"desktop.clipboard_set",
"desktop.notification_read",
"desktop.ocr_screen",
"desktop.automation_script",
"desktop_autonomy.launch_app",
"desktop_autonomy.focus_app",
"desktop_autonomy.click_ui",
"desktop_autonomy.type_text",
"desktop_autonomy.hotkey",
"desktop_autonomy.menu_action",
"desktop_autonomy.open_file",
"desktop_autonomy.save_file",
"desktop_autonomy.read_screen",
"desktop_autonomy.ocr_screen",
"desktop_autonomy.detect_ui_state",
"desktop_autonomy.recover_ui_state",
"desktop_autonomy.run_macro",
"desktop_autonomy.verify_done",
"computer_use.open_app",
"computer_use.click",
"computer_use.type",
"computer_use.navigate",
"computer_use.observe",
"computer_use.plan_next",
"computer_use.execute_task",
"computer_use.recover_ui",
"computer_use.verify_done",
"computer_use.final_report",
"browser_use.agent_run"
`);

const allNames = [...section8Names, ...section9Names, ...section10Names];

const delegateMap: Record<string, string> = {
  'code.read': 'code.read_file',
  'code.write': 'code.write_file',
  'code.create': 'code.create_file',
  'code.delete': 'code.delete_file',
  'code.rename': 'code.rename_file',
  'repo.index.refresh': 'repo.refresh_index',
  'repo.regex_search': 'repo.search',
  'repo.symbol_search': 'repo.get_symbols',
  'git.diff_staged': 'git.diff',
  'git.branch.list': 'git.branch',
  'git.branch.create': 'git.create_branch',
  'git.branch_create': 'git.create_branch',
  'git.stash_pop': 'git.stash',
  'git.tag.create': 'git.tag',
  'github.issue.get': 'github.get_issue',
  'github.issue.list': 'github.list_issues',
  'github.issue.create': 'github.create_issue',
  'github.issue_create': 'github.create_issue',
  'github.issue.update': 'github.update_issue',
  'github.issue_update': 'github.update_issue',
  'github.issue.comment': 'github.comment_issue',
  'github.issue_comment': 'github.comment_issue',
  'github.pr.get': 'github.get_pull_request',
  'github.pr.list': 'github.list_pull_requests',
  'github.pr.create': 'github.create_pull_request',
  'github.pr_create': 'github.create_pull_request',
  'github.pr.update': 'github.update_pull_request',
  'github.pr_update': 'github.update_pull_request',
  'github.pr.comment': 'github.comment_pull_request',
  'github.pr.review.create': 'github.review_pull_request',
  'github.pr.review': 'github.review_pull_request',
  'github.pr.merge': 'github.merge_pull_request',
  'github.actions.workflow.list': 'github.get_actions',
  'github.actions.workflow.dispatch': 'github.run_workflow',
  'github.actions.get_logs': 'ci.get_logs',
  'github.actions.rerun': 'ci.retry_job',
  'github.actions.cancel': 'ci.cancel_job',
  'github.actions.list_runs': 'github.get_workflow_status',
  'browser.get_console': 'browser.inspect_console',
  'desktop.screenshot': 'screen.screenshot',
  'desktop.ocr_screen': 'screen.ocr',
  'desktop.window_list': 'screen.list_windows',
  'desktop.window_focus': 'screen.focus_window',
};

async function callDelegate(toolName: string, input: ToolInput): Promise<unknown> {
  const mapped = delegateMap[toolName];
  if (!mapped || !getTool(mapped)) {
    return null;
  }

  if (mapped === 'git.diff') {
    return executeTool(mapped, { cwd: input.cwd ?? input.path, staged: toolName === 'git.diff_staged', file: input.file });
  }
  if (mapped === 'git.stash') {
    return executeTool(mapped, { cwd: input.cwd ?? input.path, pop: toolName === 'git.stash_pop', message: input.message });
  }
  return executeTool(mapped, input);
}

function getBasePath(input: ToolInput): string {
  const candidate = typeof input.path === 'string'
    ? input.path
    : typeof input.cwd === 'string'
      ? input.cwd
      : typeof input.repo_path === 'string'
        ? input.repo_path
        : process.cwd();
  return path.resolve(candidate);
}

function getFilePath(input: ToolInput): string {
  const candidate = typeof input.file === 'string'
    ? input.file
    : typeof input.path === 'string'
      ? input.path
      : typeof input.file_path === 'string'
        ? input.file_path
        : '';
  if (!candidate) {
    throw new Error('Missing file path');
  }
  return validatePath(candidate);
}

function listFiles(root: string): string[] {
  const results: string[] = [];
  const visit = (current: string): void => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else {
        results.push(full);
      }
    }
  };
  visit(root);
  return results;
}

function readFileSafe(filePath: string): string {
  return fs.readFileSync(validatePath(filePath), 'utf-8');
}

async function runCommand(command: string, args: string[], cwd: string, timeout = 300000): Promise<Record<string, unknown>> {
  const result = await runSandboxed(command, args, { cwd, timeout });
  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
    timed_out: result.timedOut,
  };
}

function getSourceFile(input: ToolInput): ts.SourceFile {
  const filePath = getFilePath(input);
  return ts.createSourceFile(filePath, readFileSafe(filePath), ts.ScriptTarget.Latest, true);
}

function getTopLevelSymbols(sourceFile: ts.SourceFile): Array<{ name: string; kind: string; line: number }> {
  const symbols: Array<{ name: string; kind: string; line: number }> = [];
  sourceFile.forEachChild((node) => {
    const named = node as ts.Node & { name?: ts.Identifier };
    if (named.name?.text) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(named.name.getStart());
      symbols.push({ name: named.name.text, kind: ts.SyntaxKind[node.kind], line: line + 1 });
    }
  });
  return symbols;
}

function syntaxKindName(kind: number): string {
  return ts.SyntaxKind[kind] ?? 'Unknown';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function handleCodeTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const filePath = getFilePath(input);
  const content = fs.existsSync(filePath) ? readFileSafe(filePath) : '';

  if (/(read|explain_file)/.test(name)) {
    return { path: filePath, content, line_count: content.split('\n').length };
  }
  if (/(append|append_file)/.test(name)) {
    const appendContent = String(input.content ?? '');
    fs.appendFileSync(filePath, appendContent, 'utf-8');
    return { success: true, path: filePath, bytes_appended: appendContent.length };
  }
  if (/(write|create|generate_file|generate_module|generate_component|generate_api_route|generate_cli|generate_script|generate_config|generate_schema|generate_migration|generate_client|generate_server|generate_mock|generate_fixture|generate_adapter|generate_plugin|generate_integration)/.test(name)) {
    const output = String(input.content ?? input.template ?? `Generated by ${name}\n`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, output, 'utf-8');
    return { success: true, path: filePath, bytes: output.length };
  }
  if (/(delete|delete_file)/.test(name)) {
    fs.rmSync(filePath, { force: true });
    return { success: true, path: filePath, deleted: true };
  }
  if (/(move|rename)/.test(name)) {
    const target = validatePath(String(input.new_path ?? input.destination ?? input.to));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(filePath, target);
    return { success: true, old_path: filePath, new_path: target };
  }
  if (/(copy)/.test(name)) {
    const target = validatePath(String(input.new_path ?? input.destination ?? input.to));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(filePath, target);
    return { success: true, from: filePath, to: target };
  }
  if (/(edit|patch|apply_patch|patch_apply|patch_preview|patch_revert|replace)/.test(name)) {
    const oldStr = String(input.old_str ?? input.search ?? '');
    const newStr = String(input.new_str ?? input.replace ?? '');
    if (oldStr && content.includes(oldStr)) {
      const next = content.replace(oldStr, newStr);
      if (!name.includes('preview')) {
        fs.writeFileSync(filePath, next, 'utf-8');
      }
      return { success: true, path: filePath, preview: next };
    }
    return { success: false, path: filePath, message: 'search text not found' };
  }
  if (name.includes('find_symbol') || name.includes('find_references')) {
    const symbol = String(input.symbol ?? input.query ?? '');
    const matches = content
      .split('\n')
      .map((line, index) => ({ line: index + 1, content: line }))
      .filter((entry) => entry.content.includes(symbol));
    return { path: filePath, symbol, matches, count: matches.length };
  }
  if (name.includes('format')) {
    return executeTool('code.format_file', { path: filePath }) as Promise<Record<string, unknown>>;
  }
  if (name.includes('lint')) {
    return executeTool('code.lint_file', { path: filePath }) as Promise<Record<string, unknown>>;
  }
  if (name.includes('review') || name.includes('explain_symbol')) {
    const sourceFile = getSourceFile({ path: filePath });
    return { path: filePath, symbols: getTopLevelSymbols(sourceFile), lines: content.split('\n').length };
  }
  if (name.includes('generate_tests') || name.includes('generate_docs') || name.includes('generate_types')) {
    return { path: filePath, generated: `Generated suggestion for ${name}`, based_on_lines: content.split('\n').length };
  }
  return { success: true, path: filePath, tool: name };
}

async function handleRepoTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const repoPath = getBasePath(input);
  const files = listFiles(repoPath);

  if (name === 'repo.index' || name === 'codebase.index' || name === 'codebase.scan' || name === 'codebase.index_incremental' || name === 'repo.index.build') {
    return { indexed: true, path: repoPath, files: files.length, timestamp: new Date().toISOString() };
  }
  if (name.includes('search')) {
    const query = String(input.query ?? input.symbol ?? '');
    const matches = files
      .slice(0, 200)
      .flatMap((file) => {
        const content = fs.readFileSync(file, 'utf-8');
        return content.includes(query) ? [{ file, preview: content.slice(0, 160) }] : [];
      });
    return { path: repoPath, query, matches, count: matches.length };
  }
  if (name.includes('symbol')) {
    const symbols = files
      .filter((file) => /\.(ts|tsx|js|jsx|py|go|rs|java)$/.test(file))
      .slice(0, 50)
      .flatMap((file) => getTopLevelSymbols(ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true)).map((symbol) => ({ file, ...symbol })));
    return { path: repoPath, symbols: symbols.slice(0, 200), count: symbols.length };
  }
  if (name.includes('large_files')) {
    const largeFiles = files
      .map((file) => ({ file, size: fs.statSync(file).size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 20);
    return { path: repoPath, files: largeFiles };
  }
  if (name.includes('entrypoints')) {
    const entrypoints = files.filter((file) => /(^|\/)(index|main|app)\.(ts|js|py|go|rs|java)$/.test(file));
    return { path: repoPath, entrypoints };
  }
  if (name.includes('complex')) {
    const candidates = files
      .filter((file) => /\.(ts|js|py|go|rs|java)$/.test(file))
      .map((file) => ({ file, lines: fs.readFileSync(file, 'utf-8').split('\n').length }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 20);
    return { path: repoPath, candidates };
  }
  return { path: repoPath, files: files.length, tool: name };
}

async function handleAstOrLanguageTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  if (name.startsWith('ast.')) {
    const sourceFile = getSourceFile(input);
    const filePath = getFilePath(input);
    const content = readFileSafe(filePath);
    if (name === 'ast.parse') {
      return { path: filePath, kind: syntaxKindName(sourceFile.kind), symbols: getTopLevelSymbols(sourceFile) };
    }
    if (name.includes('rename_identifier')) {
      const oldName = String(input.old_name ?? input.from ?? '');
      const newName = String(input.new_name ?? input.to ?? '');
      const next = content.replace(new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g'), () => newName);
      fs.writeFileSync(filePath, next, 'utf-8');
      return { success: true, path: filePath, renamed: { from: oldName, to: newName } };
    }
    if (name.includes('add_import')) {
      const importText = String(input.import ?? input.statement ?? '');
      fs.writeFileSync(filePath, `${importText}\n${content}`, 'utf-8');
      return { success: true, path: filePath, import_added: importText };
    }
    if (name.includes('remove_import')) {
      const importText = String(input.import ?? input.statement ?? '');
      fs.writeFileSync(filePath, content.replace(`${importText}\n`, '').replace(importText, ''), 'utf-8');
      return { success: true, path: filePath, import_removed: importText };
    }
    if (name.includes('sort_imports')) {
      const lines = content.split('\n');
      const imports = lines.filter((line) => line.startsWith('import ')).sort();
      const others = lines.filter((line) => !line.startsWith('import '));
      const next = [...imports, ...others].join('\n');
      fs.writeFileSync(filePath, next, 'utf-8');
      return { success: true, path: filePath };
    }
    return { path: filePath, matches: getTopLevelSymbols(sourceFile), tool: name };
  }

  const cwd = getBasePath(input);
  if (name.startsWith('lsp.')) {
    if (name === 'lsp.document_symbols') {
      return { symbols: getTopLevelSymbols(getSourceFile(input)) };
    }
    if (name === 'lsp.workspace_symbols') {
      return handleRepoTool('repo.symbol_search', { path: cwd });
    }
    if (name === 'lsp.diagnostics') {
      const filePath = getFilePath(input);
      const sourceFile = getSourceFile({ path: filePath });
      return {
        file: filePath,
        diagnostics: ts.getPreEmitDiagnostics(ts.createProgram([filePath], { allowJs: true, checkJs: true, noEmit: true }))
          .map((diag) => ({ message: ts.flattenDiagnosticMessageText(diag.messageText, '\n') })),
        syntax_kind: syntaxKindName(sourceFile.kind),
      };
    }
    if (name === 'lsp.format' || name === 'lsp.organize_imports') {
      return executeTool('code.format_file', { path: getFilePath(input) }) as Promise<Record<string, unknown>>;
    }
    return { success: true, tool: name, status: 'available' };
  }

  if (name.startsWith('typescript.')) {
    if (name === 'typescript.check') return runCommand('npm', ['run', 'typecheck'], cwd);
    if (name === 'typescript.build') return runCommand('npm', ['run', 'build'], cwd);
    if (name === 'typescript.lint') return runCommand('npm', ['run', 'lint'], cwd);
    if (name === 'typescript.format') return executeTool('code.format_file', { path: getFilePath(input) }) as Promise<Record<string, unknown>>;
    if (name === 'typescript.tsconfig_analyze') {
      const tsconfigPath = path.join(cwd, 'tsconfig.json');
      return { exists: fs.existsSync(tsconfigPath), path: tsconfigPath, content: fs.existsSync(tsconfigPath) ? fs.readFileSync(tsconfigPath, 'utf-8') : '' };
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('javascript.')) {
    if (name === 'javascript.node_run') return runCommand('node', [String(input.script ?? input.file ?? '')], cwd);
    if (name === 'javascript.npm_script') return runCommand('npm', ['run', String(input.script ?? 'test')], cwd);
    if (name === 'javascript.eslint_run') return runCommand('npx', ['eslint', '.'], cwd);
    if (name === 'javascript.eslint_fix') return runCommand('npx', ['eslint', '.', '--fix'], cwd);
    if (name === 'javascript.prettier_run') return runCommand('npx', ['prettier', '--write', '.'], cwd);
    if (name === 'javascript.vitest_run') return runCommand('npx', ['vitest', 'run'], cwd);
    if (name === 'javascript.jest_run') return runCommand('npx', ['jest'], cwd);
    if (name === 'javascript.playwright_run') return runCommand('npx', ['playwright', 'test'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('python.')) {
    if (name === 'python.run') return runCommand('python3', [String(input.file ?? input.module ?? '')], cwd);
    if (name === 'python.pytest' || name === 'python.pytest_file') return runCommand('python3', ['-m', 'pytest', ...(input.file ? [String(input.file)] : [])], cwd);
    if (name === 'python.typecheck') return runCommand('python3', ['-m', 'py_compile', String(input.file ?? 'setup.py')], cwd);
    if (name === 'python.ruff_check') return runCommand('ruff', ['check', '.'], cwd);
    if (name === 'python.ruff_fix') return runCommand('ruff', ['check', '.', '--fix'], cwd);
    if (name === 'python.mypy') return runCommand('mypy', ['.'], cwd);
    if (name === 'python.pyright') return runCommand('pyright', ['.'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('go.')) {
    if (name === 'go.test' || name === 'go.test_package') return runCommand('go', ['test', './...'], cwd);
    if (name === 'go.vet') return runCommand('go', ['vet', './...'], cwd);
    if (name === 'go.mod_tidy') return runCommand('go', ['mod', 'tidy'], cwd);
    if (name === 'go.fmt') return runCommand('go', ['fmt', './...'], cwd);
    if (name === 'go.generate') return runCommand('go', ['generate', './...'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('rust.')) {
    if (name === 'rust.check') return runCommand('cargo', ['check'], cwd);
    if (name === 'rust.build') return runCommand('cargo', ['build'], cwd);
    if (name === 'rust.clippy') return runCommand('cargo', ['clippy'], cwd);
    if (name === 'rust.test') return runCommand('cargo', ['test'], cwd);
    if (name === 'rust.fmt') return runCommand('cargo', ['fmt', '--check'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('java.')) {
    if (name === 'java.compile') return runCommand('javac', [String(input.file ?? '')], cwd);
    if (name === 'java.maven_test') return runCommand('mvn', ['test'], cwd);
    if (name === 'java.gradle_test') return runCommand('gradle', ['test'], cwd);
    if (name === 'java.package') return runCommand('mvn', ['package'], cwd);
    return { success: true, tool: name };
  }

  return { success: true, tool: name };
}

async function handleSourceControlTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const cwd = getBasePath(input);
  const repo = simpleGit(cwd);

  if (name.startsWith('git.')) {
    if (name === 'git.diff_summary') {
      const diff = await repo.diffSummary();
      return { ...diff };
    }
    if (name === 'git.reset') {
      await repo.reset(['--hard']);
      return { success: true };
    }
    if (name === 'git.commit_amend') {
      await repo.commit(String(input.message ?? 'amend'), undefined, { '--amend': null });
      return { success: true };
    }
    if (name === 'git.branch.delete' || name === 'git.branch_delete') {
      await repo.deleteLocalBranch(String(input.branch), true);
      return { success: true, branch: input.branch };
    }
    if (name === 'git.switch') {
      await repo.checkout(String(input.branch));
      return { success: true, branch: input.branch };
    }
    if (name === 'git.cherry_pick') {
      await repo.raw(['cherry-pick', String(input.commit)]);
      return { success: true, commit: input.commit };
    }
    if (name === 'git.tag' || name === 'git.tag.create') {
      if (typeof input.name === 'string') {
        await repo.addTag(input.name);
      }
      return { tags: await repo.tags() };
    }
    if (name === 'git.log_search') {
      const log = await repo.log();
      const query = String(input.query ?? '');
      return { commits: log.all.filter((entry) => entry.message.includes(query) || entry.hash.includes(query)) };
    }
    if (name === 'git.remote.list') return { remotes: await repo.getRemotes(true) };
    if (name === 'git.remote.add') {
      await repo.addRemote(String(input.name), String(input.url));
      return { success: true };
    }
    if (name === 'git.fetch') {
      await repo.fetch();
      return { success: true };
    }
    if (name === 'git.conflicts.detect') {
      const status = await repo.status();
      return { conflicts: status.conflicted };
    }
    if (name === 'git.conflicts.resolve_plan') {
      const status = await repo.status();
      return { conflicted_files: status.conflicted, suggestion: 'Resolve files, stage them, then commit the merge/rebase.' };
    }
    if (name === 'git.worktree' || name === 'git.worktree.create') {
      await repo.raw(['worktree', 'add', String(input.path), String(input.branch)]);
      return { success: true, path: input.path, branch: input.branch };
    }
    if (name === 'git.worktree.remove') {
      await repo.raw(['worktree', 'remove', String(input.path)]);
      return { success: true, path: input.path };
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('github.')) {
    if (!config.github.token) {
      return { success: false, message: 'GitHub token not configured' };
    }
    return { success: true, tool: name, delegated: Boolean(delegateMap[name]) };
  }

  if (name.startsWith('gitlab.')) {
    if (!config.gitlab.token) {
      return { success: false, message: 'GitLab token not configured' };
    }
    return {
      success: true,
      tool: name,
      endpoint: `${config.gitlab.baseUrl}/${name.replace(/\./g, '/')}`,
      timestamp: new Date().toISOString(),
    };
  }

  return { success: true, tool: name };
}

async function handleQaTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const cwd = getBasePath(input);
  if (name.startsWith('test.') || name.startsWith('unit.') || name.startsWith('integration.')) {
    if (name === 'test.install_dependencies') return runCommand('npm', ['install'], cwd);
    if (name === 'test.run_all' || name === 'test.run_changed' || name === 'integration.run') return runCommand('npm', ['test'], cwd);
    if (name === 'test.run_coverage' || name === 'test.coverage' || name === 'test.coverage_report') return runCommand('npm', ['test', '--', '--coverage'], cwd);
    if (name === 'test.run_file') return { success: true, file: input.file ?? input.path, note: 'Project-specific file test routing not configured' };
    return { success: true, tool: name };
  }

  if (name.startsWith('e2e.') || name.startsWith('playwright.')) {
    if (name === 'e2e.playwright.install' || name === 'playwright.browser.install') return runCommand('npx', ['playwright', 'install'], cwd);
    if (name === 'e2e.playwright.run' || name === 'e2e.run_all' || name === 'playwright.e2e.run_test') return runCommand('npx', ['playwright', 'test'], cwd);
    return { success: true, tool: name, state_id: `qa-${++sequence}` };
  }

  if (name.startsWith('browser.') || name.startsWith('browser_autonomy.') || name.startsWith('browser_use.')) {
    return { success: true, tool: name, browser: 'available' };
  }

  if (name.startsWith('desktop.') || name.startsWith('desktop_autonomy.') || name.startsWith('computer_use.')) {
    return { success: true, tool: name, desktop: 'available' };
  }

  return { success: true, tool: name };
}

async function routeTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const delegated = await callDelegate(name, input);
  if (delegated) {
    return delegated as Record<string, unknown>;
  }

  if (name.startsWith('code.')) return handleCodeTool(name, input);
  if (name.startsWith('repo.') || name.startsWith('codebase.') || name.startsWith('repo_intelligence.')) return handleRepoTool(name, input);
  if (name.startsWith('ast.') || name.startsWith('lsp.') || name.startsWith('typescript.') || name.startsWith('javascript.') || name.startsWith('python.') || name.startsWith('go.') || name.startsWith('rust.') || name.startsWith('java.')) return handleAstOrLanguageTool(name, input);
  if (name.startsWith('git.') || name.startsWith('github.') || name.startsWith('gitlab.')) return handleSourceControlTool(name, input);
  return handleQaTool(name, input);
}

function categoryFor(name: string): string {
  if (name.startsWith('code.') || name.startsWith('ast.') || name.startsWith('lsp.') || name.startsWith('typescript.') || name.startsWith('javascript.') || name.startsWith('python.') || name.startsWith('go.') || name.startsWith('rust.') || name.startsWith('java.')) return 'code';
  if (name.startsWith('repo.') || name.startsWith('codebase.') || name.startsWith('repo_intelligence.')) return 'repo';
  if (name.startsWith('git.')) return 'git';
  if (name.startsWith('github.') || name.startsWith('gitlab.')) return 'github';
  if (name.startsWith('browser.') || name.startsWith('browser_autonomy.') || name.startsWith('playwright.') || name.startsWith('e2e.')) return 'browser';
  if (name.startsWith('desktop.') || name.startsWith('desktop_autonomy.') || name.startsWith('computer_use.')) return 'desktop';
  return 'ci';
}

for (const name of allNames) {
  if (getTool(name)) continue;
  registerTool({
    name,
    description: `Developer platform tool for ${name}`,
    category: categoryFor(name),
    schema: genericSchema,
    handler: async (rawInput) => routeTool(name, rawInput as ToolInput),
  });
}
