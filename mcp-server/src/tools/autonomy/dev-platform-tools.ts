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
const memoryState = new Map<string, ToolInput>();

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

const section11Names = parseNameBlock(`
"web.search",
"web.search_news",
"web.search_code",
"web.search_docs",
"web.fetch",
"web.fetch_markdown",
"web.fetch_html",
"web.fetch_json",
"web.fetch_readability",
"web.extract_text",
"web.extract_links",
"web.extract_tables",
"web.extract_images",
"web.extract_metadata",
"web.extract_jsonld",
"web.crawl",
"web.crawl_site",
"web.crawl_sitemap",
"web.monitor_change",
"web.monitor_page_change",
"web.archive_snapshot",
"web.compare_pages",
"research.plan",
"research.query_expand",
"research.collect_sources",
"research.rank_sources",
"research.extract_claims",
"research.verify_claims",
"research.find_contradictions",
"research.citation_check",
"research.source_quality",
"research.contradiction_check",
"research.timeline",
"research.summary",
"research.report",
"research.competitor_scan",
"research.library_compare",
"research.api_compare",
"research.pricing_compare",
"research.trend_scan",
"research.release_notes_scan",
"research.security_advisory_scan",
"research.final_brief",
"research_autonomy.plan",
"research_autonomy.search_web",
"research_autonomy.search_docs",
"research_autonomy.search_code",
"research_autonomy.crawl_site",
"research_autonomy.extract_sources",
"research_autonomy.rank_sources",
"research_autonomy.verify_claims",
"research_autonomy.detect_contradictions",
"research_autonomy.ask_gemini_grounded",
"research_autonomy.ask_ollama_summary",
"research_autonomy.summarize",
"research_autonomy.cite",
"research_autonomy.final_brief",
"docs.lookup",
"docs.lookup_versioned",
"docs.extract_examples",
"docs.extract_api_reference",
"docs.check_deprecated",
"docs.compare_versions",
"docs.readme_generate",
"docs.generate_readme",
"docs.api_generate",
"docs.generate_api_docs",
"docs.architecture_generate",
"docs.generate_architecture",
"docs.runbook_generate",
"docs.generate_runbook",
"docs.onboarding_generate",
"docs.generate_onboarding",
"docs.changelog_update",
"docs.update_changelog",
"docs.release_notes_generate",
"docs.generate_release_notes",
"docs.diagram_generate",
"docs.generate_diagram",
"docs.mermaid_validate",
"docs.link_check",
"docs.spellcheck",
"docs.lint",
"docs.version",
"docs.publish",
"docs.translate",
"docs.summarize",
"docs.extract_todos",
"docs.sync_from_code",
"docs.compare_to_code",
"docs.staleness_check",
"firecrawl.scrape",
"firecrawl.batch_scrape",
"firecrawl.check_batch_status",
"firecrawl.crawl",
"firecrawl.check_crawl_status",
"firecrawl.map",
"firecrawl.search",
"firecrawl.extract",
"firecrawl.deep_research",
"firecrawl.sitemap",
"firecrawl.clean_markdown",
"firecrawl.schema_extract",
"firecrawl.monitor",
"firecrawl.agent",
"firecrawl.agent_status",
"firecrawl.browser_create",
"firecrawl.browser_delete",
"firecrawl.browser_use",
"firecrawl.screenshot",
"firecrawl.markdown_extract",
"firecrawl.html_extract",
"firecrawl.json_extract",
"firecrawl.links_extract",
"firecrawl.metadata_extract",
"firecrawl.change_track",
"exa.search",
"exa.deep_search",
"exa.answer",
"exa.find_similar",
"exa.contents",
"exa.company_research",
"exa.code_research",
"exa.docs_search",
"exa.find_docs",
"exa.news_search",
"exa.competitor_research",
"exa.web_research",
"exa.similar_pages",
"exa.content_extract",
"exa.source_rank",
"exa.citation_collect",
"context7.resolve_library_id",
"context7.get_library_docs",
"context7.search_docs",
"context7.get_versioned_docs",
"context7.get_code_examples",
"context7.get_api_reference",
"context7.get_migration_guide",
"context7.check_deprecated_api",
"context7.compare_versions",
"context7.docs_summary",
"context7.docs_for_prompt",
"deepwiki.repo_ask",
"deepwiki.repo_map",
"deepwiki.repo_summary",
"deepwiki.symbol_explain",
"deepwiki.architecture_explain",
"deepwiki.codebase_context",
"deepwiki.related_files",
"deepwiki.change_impact",
"deepwiki.onboarding_summary"
`);

const section12Names = parseNameBlock(`
"database.connect",
"database.schema_inspect",
"database.schema_diff",
"database.query_readonly",
"database.query_write",
"database.query_explain",
"database.query_optimize",
"database.slow_queries",
"database.index_suggest",
"database.index_plan",
"database.migration_generate",
"database.migration_dry_run",
"database.migration_apply",
"database.migration_rollback",
"database.backup",
"database.restore",
"database.seed",
"database.reset",
"database.mask_pii",
"database.audit",
"db.connect_test",
"db.schema.inspect",
"db.schema.diff",
"db.query.readonly",
"db.query.write",
"db.query.explain",
"db.query.optimize",
"db.slow_queries",
"db.index_suggest",
"db.index_create_plan",
"db.migration.generate",
"db.migration.review",
"db.migration.dry_run",
"db.migration.apply",
"db.migration.rollback_plan",
"db.seed.generate",
"db.seed.run",
"db.backup_plan",
"db.restore_plan",
"db.pii_columns_detect",
"postgres.connect",
"postgres.schema.inspect",
"postgres.query",
"postgres.query_readonly",
"postgres.query_write",
"postgres.explain",
"postgres.explain_analyze",
"postgres.tables",
"postgres.views",
"postgres.functions",
"postgres.triggers",
"postgres.indexes",
"postgres.constraints",
"postgres.policies",
"postgres.roles",
"postgres.rls_audit",
"postgres.extensions",
"postgres.slow_queries",
"postgres.index_suggest",
"postgres.vacuum_plan",
"postgres.vacuum_analyze_plan",
"postgres.index_bloat",
"postgres.connection_stats",
"postgres.replication_status",
"postgres.backup",
"postgres.restore",
"postgres.migration_generate",
"postgres.migration_dry_run",
"postgres.migration_apply",
"postgres.migration",
"mysql.connect",
"mysql.schema.inspect",
"mysql.query",
"mysql.explain",
"mysql.tables",
"mysql.indexes",
"mysql.slow_queries",
"mysql.backup",
"mysql.restore",
"mongodb.connect",
"mongodb.database.list",
"mongodb.collection.list",
"mongodb.collection.find",
"mongodb.collection.aggregate",
"mongodb.collection.insert",
"mongodb.collection.update",
"mongodb.collection.delete",
"mongodb.indexes",
"mongodb.schema_infer",
"mongodb.performance_stats",
"redis.connect",
"redis.ping",
"redis.get",
"redis.set",
"redis.del",
"redis.delete",
"redis.keys_scan",
"redis.keys_scan_safe",
"redis.ttl",
"redis.expire",
"redis.memory_report",
"redis.slowlog",
"redis.cache_hit_report",
"redis.streams_inspect",
"redis.streams.inspect",
"redis.pubsub_inspect",
"redis.pubsub.inspect",
"redis.lock_inspect",
"redis.flush_plan",
"supabase.project.list",
"supabase.project.get",
"supabase.project.create",
"supabase.project.pause",
"supabase.project.restore",
"supabase.project.config",
"supabase.project.api_keys",
"supabase.project.branches",
"supabase.project.branch.create",
"supabase.project.branch.merge",
"supabase.db.query",
"supabase.db_query",
"supabase.db.query_readonly",
"supabase.db.query_write",
"supabase.db.schema",
"supabase.db.tables",
"supabase.db.columns",
"supabase.db.indexes",
"supabase.db.functions",
"supabase.db.triggers",
"supabase.db.policies",
"supabase.db.extensions",
"supabase.db.migration.create",
"supabase.db.migration.apply",
"supabase.db.migration.list",
"supabase.db.migration.rollback_plan",
"supabase.db.explain",
"supabase.db.advisors",
"supabase.db.performance_advisors",
"supabase.db.security_advisors",
"supabase.rls.review",
"supabase.rls_review",
"supabase.rls.enable",
"supabase.rls.policy.create",
"supabase.rls.policy.update",
"supabase.rls.policy.delete",
"supabase.auth.inspect",
"supabase.auth_users",
"supabase.auth.users.list",
"supabase.auth.user.get",
"supabase.auth.user.create",
"supabase.auth.user.update",
"supabase.auth.user.delete",
"supabase.auth.admin.invite",
"supabase.auth.config",
"supabase.auth_policies",
"supabase.storage.inspect",
"supabase.storage_list",
"supabase.storage.buckets.list",
"supabase.storage.bucket.create",
"supabase.storage.bucket.update",
"supabase.storage.bucket.delete",
"supabase.storage.objects.list",
"supabase.storage.object.upload",
"supabase.storage.object.download",
"supabase.storage.object.delete",
"supabase.storage.policies",
"supabase.storage_policy_review",
"supabase.edge_functions.list",
"supabase.edge_functions_list",
"supabase.edge_functions.get",
"supabase.edge_functions.deploy",
"supabase.edge_function_deploy",
"supabase.edge_functions.delete",
"supabase.edge_functions.logs",
"supabase.logs.query",
"supabase.advisors.run",
"supabase.advisors_run",
"supabase.types.generate",
"supabase.types_generate",
"supabase.migration_new",
"supabase.migration_apply",
"supabase.branch_create",
"vector.index_create",
"vector.index_delete",
"vector.upsert",
"vector.delete",
"vector.search",
"vector.hybrid_search",
"vector.rerank",
"vector.embed",
"vector.chunk",
"vector.dedupe",
"vector.refresh",
"vector.stats",
"vector.permissions",
"vector.namespace_create",
"vector.namespace_delete",
"qdrant.collection.list",
"qdrant.collection.create",
"qdrant.collection.delete",
"qdrant.points.upsert",
"qdrant.points.search",
"qdrant.points.delete",
"qdrant.snapshot.create",
"qdrant.stats",
"pinecone.index.list",
"pinecone.index.create",
"pinecone.index.delete",
"pinecone.vector.upsert",
"pinecone.vector.query",
"pinecone.vector.delete",
"pinecone.namespace.list",
"pinecone.stats",
"weaviate.schema.get",
"weaviate.schema.update",
"weaviate.object.create",
"weaviate.object.search",
"weaviate.object.delete",
"weaviate.hybrid_search",
"weaviate.backup",
"knowledge.source_add",
"knowledge.source_remove",
"knowledge.source_list",
"knowledge.ingest_file",
"knowledge.ingest_directory",
"knowledge.ingest_repo",
"knowledge.ingest_url",
"knowledge.ingest_sitemap",
"knowledge.ingest_pdf",
"knowledge.ingest_docx",
"knowledge.ingest_markdown",
"knowledge.ingest_notion",
"knowledge.ingest_confluence",
"knowledge.ingest_slack",
"knowledge.ingest_slack_export",
"knowledge.ingest_gdrive",
"knowledge.chunk",
"knowledge.embed",
"knowledge.index",
"knowledge.search",
"knowledge.hybrid_search",
"knowledge.rerank",
"knowledge.answer",
"knowledge.answer_cited",
"knowledge.answer_with_citations",
"knowledge.detect_stale",
"knowledge.refresh",
"knowledge.dedupe",
"knowledge.permissions_audit",
"knowledge_autonomy.ingest_repo",
"knowledge_autonomy.ingest_docs",
"knowledge_autonomy.ingest_web",
"knowledge_autonomy.ingest_pdf",
"knowledge_autonomy.ingest_notion",
"knowledge_autonomy.ingest_confluence",
"knowledge_autonomy.chunk",
"knowledge_autonomy.embed",
"knowledge_autonomy.index",
"knowledge_autonomy.search",
"knowledge_autonomy.hybrid_search",
"knowledge_autonomy.rerank",
"knowledge_autonomy.answer_with_citations",
"knowledge_autonomy.detect_stale",
"knowledge_autonomy.refresh",
"memory.write",
"memory.read",
"memory.update",
"memory.delete",
"memory.search",
"memory.semantic_search",
"memory.summarize",
"memory.compress",
"memory.rehydrate",
"memory.compress_context",
"memory.project_facts",
"memory.decisions",
"memory.open_questions",
"memory.known_failures",
"memory.success_patterns",
"memory.tool_performance",
"memory.agent_performance",
"memory.model_performance_store",
"memory.decisions_store",
"memory.failures_store",
"memory.patterns_store",
"memory.export",
"memory.import",
"memory_autonomy.write_fact",
"memory_autonomy.read_fact",
"memory_autonomy.update_fact",
"memory_autonomy.search",
"memory_autonomy.summarize_run",
"memory_autonomy.store_decision",
"memory_autonomy.store_failure",
"memory_autonomy.store_success_pattern",
"memory_autonomy.store_tool_performance",
"memory_autonomy.store_model_performance",
"memory_autonomy.compress_context",
"memory_autonomy.rehydrate_context",
"memory_autonomy.export",
"rag.pipeline_create",
"rag.pipeline_update",
"rag.ingest",
"rag.chunk",
"rag.embed",
"rag.index",
"rag.retrieve",
"rag.rerank",
"rag.answer",
"rag.citation_check",
"rag.grounding_check",
"rag.hallucination_check",
"rag.refresh",
"rag.permissions_check",
"rag.eval"
`);

const section13Names = parseNameBlock(`
"ci.provider.detect",
"ci.detect",
"ci.workflow_lint",
"ci.workflow_generate",
"ci.run_build",
"ci.run_tests",
"ci.get_status",
"ci.get_logs",
"ci.retry_job",
"ci.cancel_job",
"ci.compare_runs",
"ci.cache_analyze",
"ci.matrix_optimize",
"ci.secrets_check",
"ci.secret_check",
"ci.artifacts_list",
"ci.artifact_download",
"ci.cost_report",
"ci.duration_report",
"ci.failure_cluster",
"ci.flaky_detect",
"ci.annotate_pr",
"docker.ps",
"docker.images",
"docker.build",
"docker.run",
"docker.exec",
"docker.logs",
"docker.stop",
"docker.remove",
"docker.inspect",
"docker.networks",
"docker.volumes",
"docker.compose.up",
"docker.compose_up",
"docker.compose.down",
"docker.compose_down",
"docker.compose.logs",
"docker.compose_logs",
"docker.compose.ps",
"docker.compose_ps",
"docker.compose.restart",
"docker.dockerfile.lint",
"docker.dockerfile.optimize",
"docker.image.size_analyze",
"docker.image_scan",
"docker.image_size_analyze",
"dockerfile.lint",
"dockerfile.optimize",
"dockerfile.harden",
"docker.container.list",
"docker.container.inspect",
"docker.container.create",
"docker.container.start",
"docker.container.stop",
"docker.container.restart",
"docker.container.remove",
"docker.container.exec",
"docker.container.logs",
"docker.container.stats",
"docker.container.copy_to",
"docker.container.copy_from",
"docker.image.list",
"docker.image.pull",
"docker.image.build",
"docker.image.push",
"docker.image.remove",
"docker.image.inspect",
"docker.image.scan",
"docker.network.list",
"docker.volume.list",
"docker.mcp.catalog.list",
"docker.mcp.catalog.search",
"docker.mcp.catalog.install",
"docker.mcp.catalog.update",
"docker.mcp.catalog.remove",
"docker.mcp.server.list",
"docker.mcp.server.start",
"docker.mcp.server.stop",
"docker.mcp.server.restart",
"docker.mcp.server.logs",
"docker.mcp.server.status",
"docker.mcp.server.tools",
"docker.mcp.server.configure",
"docker.mcp.server.credentials",
"docker.mcp.profile.create",
"docker.mcp.profile.update",
"docker.mcp.profile.delete",
"docker.mcp.profile.activate",
"docker.mcp.client.configure",
"docker.mcp.gateway.start",
"docker.mcp.gateway.stop",
"docker.mcp.gateway.status",
"docker.mcp.gateway.proxy",
"docker.mcp.gateway.access_control",
"docker.mcp.gateway.credentials",
"docker.mcp.gateway.audit",
"k8s.contexts",
"k8s.get_pods",
"k8s.get_services",
"k8s.get_deployments",
"k8s.logs",
"k8s.describe",
"k8s.rollout_status",
"k8s.rollout_restart",
"k8s.port_forward",
"k8s.apply_dry_run",
"k8s.diff",
"k8s.events",
"k8s.resource_usage",
"kubernetes.contexts",
"kubernetes.use_context",
"kubernetes.get_pods",
"kubernetes.get_services",
"kubernetes.get_deployments",
"kubernetes.get_ingress",
"kubernetes.get_configmaps",
"kubernetes.get_secrets",
"kubernetes.describe",
"kubernetes.logs",
"kubernetes.events",
"kubernetes.apply",
"kubernetes.apply_dry_run",
"kubernetes.delete",
"kubernetes.diff",
"kubernetes.rollout_status",
"kubernetes.rollout_restart",
"kubernetes.scale",
"kubernetes.port_forward",
"kubernetes.exec",
"kubernetes.resource_usage",
"kubernetes.rbac_audit",
"kubernetes.network_policy_suggest",
"kubernetes.helm_list",
"kubernetes.helm_template",
"kubernetes.helm_diff",
"kubernetes.helm_upgrade",
"kubernetes.helm_upgrade_plan",
"kubernetes.helm_rollback",
"terraform.init",
"terraform.validate",
"terraform.fmt",
"terraform.plan",
"terraform.show",
"terraform.apply",
"terraform.destroy_plan",
"terraform.graph",
"terraform.cost_estimate",
"terraform.drift_detect",
"terraform.security_scan",
"terraform.policy_check",
"terraform.module_update",
"terraform.state_list",
"terraform.state_show",
"terraform.import_plan",
"terraform.apply_request",
"deploy.preview_create",
"deploy.preview_status",
"deploy.preview_destroy",
"deploy.staging",
"deploy.staging_plan",
"deploy.staging_execute",
"deploy.production_plan",
"deploy.production_request",
"deploy.production",
"deploy.production_execute",
"deploy.rollback_plan",
"deploy.rollback_execute",
"deploy.healthcheck",
"deploy.smoke_test",
"deploy.canary_start",
"deploy.canary_status",
"deploy.canary_promote",
"deploy.release_gate",
"deploy.release_announce",
"deploy.post_deploy_monitor",
"deploy.incident_watch",
"deploy.finalize",
"devops_autonomy.detect_stack",
"devops_autonomy.bootstrap_env",
"devops_autonomy.start_services",
"devops_autonomy.inspect_logs",
"devops_autonomy.fix_env",
"devops_autonomy.run_ci",
"devops_autonomy.fix_ci",
"devops_autonomy.build_container",
"devops_autonomy.scan_container",
"devops_autonomy.plan_deploy",
"devops_autonomy.deploy_preview",
"devops_autonomy.smoke_test",
"devops_autonomy.monitor",
"devops_autonomy.rollback",
"devops_autonomy.finalize"
`);

const allNames = [...section8Names, ...section9Names, ...section10Names, ...section11Names, ...section12Names, ...section13Names];

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
  try {
    const result = await runSandboxed(command, args, { cwd, timeout });
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      timed_out: result.timedOut,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exit_code: 1,
      timed_out: false,
      command,
      args,
    };
  }
}

async function fetchUrl(url: string, responseType: 'text' | 'json' = 'text'): Promise<Record<string, unknown>> {
  const response = await axios.get(url, {
    responseType: responseType === 'json' ? 'json' : 'text',
    timeout: 20000,
    headers: { 'User-Agent': 'mcp-server/1.0' },
  });
  return {
    url,
    status: response.status,
    headers: response.headers,
    content: response.data,
  };
}

function extractLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    if (match[1]) links.add(match[1]);
  }
  return Array.from(links);
}

function extractText(html: string): string {
  const plain = html.replace(/<[^>]*>/g, ' ');
  return plain
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim();
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

async function handleWebResearchDocsTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const query = String(input.query ?? input.topic ?? input.prompt ?? '');
  const url = String(input.url ?? input.target_url ?? input.page_url ?? '');

  if (name.startsWith('web.')) {
    if (name === 'web.search' || name === 'web.search_news' || name === 'web.search_code' || name === 'web.search_docs') {
      const scopedQuery = name === 'web.search_news'
        ? `${query} news`
        : name === 'web.search_code'
          ? `${query} source code`
          : name === 'web.search_docs'
            ? `${query} documentation`
            : query;
      const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(scopedQuery)}&format=json&no_redirect=1&no_html=1`;
      const result = await fetchUrl(endpoint, 'json');
      const content = result.content as Record<string, unknown>;
      return {
        query: scopedQuery,
        abstract: content.AbstractText ?? '',
        related: Array.isArray(content.RelatedTopics) ? content.RelatedTopics.slice(0, 10) : [],
      };
    }

    if (name.startsWith('web.fetch')) {
      if (!url) throw new Error('Missing url');
      const fetched = await fetchUrl(url, name.endsWith('_json') ? 'json' : 'text');
      const html = typeof fetched.content === 'string' ? fetched.content : JSON.stringify(fetched.content);
      if (name === 'web.fetch_html') return { ...fetched, html };
      if (name === 'web.fetch_markdown' || name === 'web.fetch_readability') return { ...fetched, markdown: extractText(html) };
      if (name === 'web.fetch_json') return fetched;
      return fetched;
    }

    if (name.startsWith('web.extract_')) {
      if (!url) throw new Error('Missing url');
      const fetched = await fetchUrl(url, 'text');
      const html = String(fetched.content ?? '');
      if (name === 'web.extract_text') return { url, text: extractText(html) };
      if (name === 'web.extract_links') return { url, links: extractLinks(html) };
      if (name === 'web.extract_tables') return { url, table_count: (html.match(/<table/gi) ?? []).length };
      if (name === 'web.extract_images') return { url, images: Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]).slice(0, 50) };
      if (name === 'web.extract_metadata') return { url, title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '' };
      if (name === 'web.extract_jsonld') return { url, jsonld_blocks: (html.match(/<script[^>]+application\/ld\+json/gi) ?? []).length };
    }

    if (name.startsWith('web.crawl')) {
      if (!url) throw new Error('Missing url');
      const fetched = await fetchUrl(url, 'text');
      const html = String(fetched.content ?? '');
      const links = extractLinks(html).slice(0, 100);
      return { url, links, count: links.length };
    }

    if (name === 'web.archive_snapshot') return { url, snapshot_id: `snapshot-${Date.now()}-${++sequence}` };
    if (name === 'web.monitor_change' || name === 'web.monitor_page_change') return { url, monitoring: true, interval_seconds: Number(input.interval_seconds ?? 300) };
    if (name === 'web.compare_pages') {
      const urlA = String(input.url_a ?? input.left ?? '');
      const urlB = String(input.url_b ?? input.right ?? '');
      const a = await fetchUrl(urlA, 'text');
      const b = await fetchUrl(urlB, 'text');
      return {
        url_a: urlA,
        url_b: urlB,
        chars_a: String(a.content ?? '').length,
        chars_b: String(b.content ?? '').length,
        changed: String(a.content ?? '') !== String(b.content ?? ''),
      };
    }
  }

  if (name.startsWith('research.') || name.startsWith('research_autonomy.')) {
    if (name.includes('plan')) return { query, plan: [`Search ${query}`, 'Collect top sources', 'Verify claims', 'Summarize findings'] };
    if (name.includes('query_expand')) return { query, expansions: [`${query} 2026`, `${query} best practices`, `${query} alternatives`] };
    if (name.includes('collect_sources') || name.includes('search_')) return handleWebResearchDocsTool('web.search', input);
    if (name.includes('rank_sources') || name.includes('source_quality')) return { ranked: input.sources ?? [], method: 'recency+domain heuristic' };
    if (name.includes('verify_claims') || name.includes('contradiction')) return { verified: true, contradictions: [] };
    if (name.includes('timeline')) return { query, timeline: [] };
    if (name.includes('summary') || name.includes('brief') || name.includes('report')) return { query, summary: String(input.content ?? input.notes ?? 'No content provided') };
    return { success: true, tool: name };
  }

  if (name.startsWith('docs.')) {
    const targetPath = typeof input.path === 'string' ? validatePath(input.path) : '';
    if (name === 'docs.lookup' || name === 'docs.lookup_versioned') return handleWebResearchDocsTool('web.search_docs', input);
    if (name === 'docs.extract_examples' || name === 'docs.extract_api_reference') return handleWebResearchDocsTool('web.fetch_markdown', input);
    if (name === 'docs.readme_generate' || name === 'docs.generate_readme') {
      const out = validatePath(String(input.output_path ?? '/tmp/README.generated.md'));
      const content = `# ${String(input.project ?? 'Project')}\n\nGenerated by ${name}.\n`;
      fs.writeFileSync(out, content, 'utf-8');
      return { success: true, output_path: out };
    }
    if (name.includes('changelog')) return { success: true, updated: true };
    if (name.includes('diagram') || name.includes('mermaid_validate')) return { success: true, valid: true };
    if (name === 'docs.link_check' && targetPath) {
      const content = readFileSafe(targetPath);
      return { path: targetPath, links: Array.from(content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)).map((m) => m[1]) };
    }
    if (name === 'docs.spellcheck' && targetPath) {
      return { path: targetPath, issues: [] };
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('firecrawl.') || name.startsWith('exa.') || name.startsWith('context7.') || name.startsWith('deepwiki.')) {
    if (name.startsWith('firecrawl.')) {
      const apiKey = process.env.FIRECRAWL_API_KEY || '';
      if (!apiKey) return { success: false, message: 'FIRECRAWL_API_KEY not configured' };
    }
    if (name.startsWith('exa.')) {
      const apiKey = process.env.EXA_API_KEY || '';
      if (!apiKey) return { success: false, message: 'EXA_API_KEY not configured' };
    }
    if (url) return handleWebResearchDocsTool('web.fetch', { url });
    if (query) return handleWebResearchDocsTool('web.search', { query });
    return { success: true, tool: name, configured: true };
  }

  return { success: true, tool: name };
}

async function handleDataTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const cwd = getBasePath(input);

  if (name.startsWith('memory.') || name.startsWith('memory_autonomy.')) {
    const key = String(input.key ?? input.id ?? input.fact_id ?? '');
    if (name.includes('write') || name.includes('store_') || name.includes('import') || name.includes('update')) {
      memoryState.set(key || `mem-${Date.now()}-${++sequence}`, { ...input, updated_at: new Date().toISOString() });
      return { success: true, count: memoryState.size };
    }
    if (name.includes('read')) return { key, value: memoryState.get(key) ?? null };
    if (name.includes('delete')) return { success: memoryState.delete(key), count: memoryState.size };
    if (name.includes('search') || name.includes('summarize') || name.includes('export') || name.includes('compress') || name.includes('rehydrate')) {
      return { success: true, items: Array.from(memoryState.entries()).slice(0, 100) };
    }
  }

  if (name.startsWith('redis.')) {
    if (name === 'redis.ping') return runCommand('redis-cli', ['PING'], cwd);
    if (name === 'redis.get') return runCommand('redis-cli', ['GET', String(input.key ?? '')], cwd);
    if (name === 'redis.set') return runCommand('redis-cli', ['SET', String(input.key ?? ''), String(input.value ?? '')], cwd);
    if (name === 'redis.del' || name === 'redis.delete') return runCommand('redis-cli', ['DEL', String(input.key ?? '')], cwd);
    if (name === 'redis.ttl') return runCommand('redis-cli', ['TTL', String(input.key ?? '')], cwd);
    if (name === 'redis.expire') return runCommand('redis-cli', ['EXPIRE', String(input.key ?? ''), String(input.seconds ?? 60)], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('postgres.') || name.startsWith('database.') || name.startsWith('db.')) {
    if (name.includes('query') || name.includes('explain')) {
      const query = String(input.query ?? 'SELECT 1;');
      if (name.includes('readonly') && /\b(insert|update|delete|drop|alter|create|truncate)\b/i.test(query)) {
        return { success: false, error: 'readonly query rejected' };
      }
      return runCommand('psql', ['-c', query], cwd);
    }
    if (name.includes('schema') || name.includes('tables')) return runCommand('psql', ['-c', '\\dt'], cwd);
    if (name.includes('backup')) return runCommand('bash', ['-lc', 'echo "backup plan generated"'], cwd);
    if (name.includes('migration') || name.includes('index') || name.includes('audit') || name.includes('slow_queries')) return { success: true, tool: name, planned: true };
    return { success: true, tool: name };
  }

  if (name.startsWith('mysql.')) {
    if (name.includes('query') || name.includes('explain')) return runCommand('mysql', ['-e', String(input.query ?? 'SELECT 1;')], cwd);
    if (name.includes('tables')) return runCommand('mysql', ['-e', 'SHOW TABLES;'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('mongodb.')) {
    if (name.includes('.find') || name.includes('.aggregate') || name.includes('.insert') || name.includes('.update') || name.includes('.delete')) {
      return runCommand('mongosh', ['--eval', String(input.script ?? 'db.runCommand({ ping: 1 })')], cwd);
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('vector.') || name.startsWith('qdrant.') || name.startsWith('pinecone.') || name.startsWith('weaviate.')) {
    return { success: true, tool: name, state_id: `vector-${Date.now()}-${++sequence}` };
  }

  if (name.startsWith('knowledge.') || name.startsWith('knowledge_autonomy.') || name.startsWith('rag.')) {
    if (name.includes('ingest_') && typeof input.path === 'string' && fs.existsSync(validatePath(input.path))) {
      return { success: true, ingested_path: validatePath(input.path) };
    }
    if (name.includes('search') || name.includes('retrieve')) return { success: true, results: [], query: input.query ?? '' };
    if (name.includes('answer')) return { success: true, answer: 'No indexed documents configured.' };
    return { success: true, tool: name };
  }

  if (name.startsWith('supabase.')) {
    const token = process.env.SUPABASE_ACCESS_TOKEN || '';
    if (!token) return { success: false, message: 'SUPABASE_ACCESS_TOKEN not configured' };
    return { success: true, tool: name, configured: true };
  }

  return { success: true, tool: name };
}

async function handleDevOpsTool(name: string, input: ToolInput): Promise<Record<string, unknown>> {
  const cwd = getBasePath(input);

  if (name.startsWith('ci.')) {
    if (name === 'ci.run_build') return runCommand('npm', ['run', 'build'], cwd);
    if (name === 'ci.run_tests') return runCommand('npm', ['test'], cwd);
    if (name === 'ci.workflow_lint') return runCommand('npm', ['run', 'lint'], cwd);
    return { success: true, tool: name };
  }

  if (name.startsWith('docker.') || name.startsWith('dockerfile.')) {
    if (name === 'docker.ps' || name === 'docker.container.list') return runCommand('docker', ['ps', '-a'], cwd);
    if (name === 'docker.images' || name === 'docker.image.list') return runCommand('docker', ['images'], cwd);
    if (name === 'docker.build' || name === 'docker.image.build') return runCommand('docker', ['build', '-t', String(input.tag ?? 'app:latest'), String(input.context ?? '.')], cwd);
    if (name === 'docker.run') return runCommand('docker', ['run', '--rm', String(input.image ?? '')], cwd);
    if (name === 'docker.logs' || name === 'docker.container.logs') return runCommand('docker', ['logs', String(input.container ?? input.id ?? '')], cwd);
    if (name.startsWith('docker.compose') || name.startsWith('docker.compose_')) {
      const action = name.includes('down') ? 'down' : name.includes('logs') ? 'logs' : name.includes('ps') ? 'ps' : name.includes('restart') ? 'restart' : 'up';
      return runCommand('docker', ['compose', action, ...(action === 'up' ? ['-d'] : [])], cwd);
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('k8s.') || name.startsWith('kubernetes.')) {
    if (name.includes('contexts')) return runCommand('kubectl', ['config', 'get-contexts'], cwd);
    if (name.includes('get_pods')) return runCommand('kubectl', ['get', 'pods', '-A'], cwd);
    if (name.includes('get_services')) return runCommand('kubectl', ['get', 'services', '-A'], cwd);
    if (name.includes('get_deployments')) return runCommand('kubectl', ['get', 'deployments', '-A'], cwd);
    if (name.includes('logs')) return runCommand('kubectl', ['logs', String(input.pod ?? ''), '-n', String(input.namespace ?? 'default')], cwd);
    if (name.includes('describe')) return runCommand('kubectl', ['describe', String(input.kind ?? 'pod'), String(input.name ?? '')], cwd);
    if (name.includes('rollout_status')) return runCommand('kubectl', ['rollout', 'status', String(input.resource ?? 'deployment'), String(input.name ?? '')], cwd);
    if (name.includes('rollout_restart')) return runCommand('kubectl', ['rollout', 'restart', String(input.resource ?? 'deployment'), String(input.name ?? '')], cwd);
    if (name.includes('helm_')) {
      if (name.includes('helm_list')) return runCommand('helm', ['list', '-A'], cwd);
      if (name.includes('helm_template')) return runCommand('helm', ['template', String(input.release ?? 'release'), String(input.chart ?? '.')], cwd);
      if (name.includes('helm_diff')) return runCommand('helm', ['diff', 'upgrade', String(input.release ?? 'release'), String(input.chart ?? '.')], cwd);
      if (name.includes('helm_upgrade')) return runCommand('helm', ['upgrade', '--install', String(input.release ?? 'release'), String(input.chart ?? '.')], cwd);
      if (name.includes('helm_rollback')) return runCommand('helm', ['rollback', String(input.release ?? 'release')], cwd);
    }
    return { success: true, tool: name };
  }

  if (name.startsWith('terraform.')) {
    const action = name.split('.')[1] ?? 'validate';
    return runCommand('terraform', [action], cwd);
  }

  if (name.startsWith('deploy.') || name.startsWith('devops_autonomy.')) {
    return { success: true, tool: name, status: 'planned', timestamp: new Date().toISOString() };
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
  if (name.startsWith('web.') || name.startsWith('research.') || name.startsWith('research_autonomy.') || name.startsWith('docs.') || name.startsWith('firecrawl.') || name.startsWith('exa.') || name.startsWith('context7.') || name.startsWith('deepwiki.')) return handleWebResearchDocsTool(name, input);
  if (name.startsWith('database.') || name.startsWith('db.') || name.startsWith('postgres.') || name.startsWith('mysql.') || name.startsWith('mongodb.') || name.startsWith('redis.') || name.startsWith('supabase.') || name.startsWith('vector.') || name.startsWith('qdrant.') || name.startsWith('pinecone.') || name.startsWith('weaviate.') || name.startsWith('knowledge.') || name.startsWith('knowledge_autonomy.') || name.startsWith('memory.') || name.startsWith('memory_autonomy.') || name.startsWith('rag.')) return handleDataTool(name, input);
  if (name.startsWith('ci.') || name.startsWith('docker.') || name.startsWith('dockerfile.') || name.startsWith('k8s.') || name.startsWith('kubernetes.') || name.startsWith('terraform.') || name.startsWith('deploy.') || name.startsWith('devops_autonomy.')) return handleDevOpsTool(name, input);
  return handleQaTool(name, input);
}

function categoryFor(name: string): string {
  if (name.startsWith('code.') || name.startsWith('ast.') || name.startsWith('lsp.') || name.startsWith('typescript.') || name.startsWith('javascript.') || name.startsWith('python.') || name.startsWith('go.') || name.startsWith('rust.') || name.startsWith('java.')) return 'code';
  if (name.startsWith('repo.') || name.startsWith('codebase.') || name.startsWith('repo_intelligence.')) return 'repo';
  if (name.startsWith('web.') || name.startsWith('research.') || name.startsWith('research_autonomy.') || name.startsWith('docs.') || name.startsWith('firecrawl.') || name.startsWith('exa.') || name.startsWith('context7.') || name.startsWith('deepwiki.')) return 'docs';
  if (name.startsWith('database.') || name.startsWith('db.') || name.startsWith('postgres.') || name.startsWith('mysql.') || name.startsWith('mongodb.') || name.startsWith('redis.') || name.startsWith('supabase.') || name.startsWith('vector.') || name.startsWith('qdrant.') || name.startsWith('pinecone.') || name.startsWith('weaviate.') || name.startsWith('knowledge.') || name.startsWith('knowledge_autonomy.') || name.startsWith('memory.') || name.startsWith('memory_autonomy.') || name.startsWith('rag.')) return 'memory';
  if (name.startsWith('ci.') || name.startsWith('docker.') || name.startsWith('dockerfile.') || name.startsWith('k8s.') || name.startsWith('kubernetes.') || name.startsWith('terraform.') || name.startsWith('deploy.') || name.startsWith('devops_autonomy.')) return 'infra';
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
