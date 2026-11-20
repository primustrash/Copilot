import { z } from 'zod';
import { registerTool } from '../../registry';
import { validatePath } from '../../utils/sandbox';
import { runSandboxed } from '../../utils/sandbox';
import fs from 'fs';
import path from 'path';

registerTool({
  name: 'code.read_file',
  description: 'Read a code file',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    const lines = content.split('\n');
    return { path: safePath, content, line_count: lines.length };
  },
});

registerTool({
  name: 'code.write_file',
  description: 'Write content to a code file',
  category: 'code',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: filePath, content } = input as { path: string; content: string };
    const safePath = validatePath(filePath);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath, bytes: content.length };
  },
});

registerTool({
  name: 'code.edit_file',
  description: 'Edit specific lines of a code file',
  category: 'code',
  schema: z.object({
    path: z.string(),
    old_str: z.string(),
    new_str: z.string(),
  }),
  handler: async (input) => {
    const { path: filePath, old_str, new_str } = input as { path: string; old_str: string; new_str: string };
    const safePath = validatePath(filePath);
    let content = fs.readFileSync(safePath, 'utf-8');
    if (!content.includes(old_str)) {
      throw new Error(`String not found in file: ${old_str.slice(0, 50)}...`);
    }
    content = content.replace(old_str, new_str);
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath };
  },
});

registerTool({
  name: 'code.multi_edit',
  description: 'Apply multiple edits to a code file',
  category: 'code',
  schema: z.object({
    path: z.string(),
    edits: z.array(z.object({ old_str: z.string(), new_str: z.string() })),
  }),
  handler: async (input) => {
    const { path: filePath, edits } = input as { path: string; edits: Array<{ old_str: string; new_str: string }> };
    const safePath = validatePath(filePath);
    let content = fs.readFileSync(safePath, 'utf-8');
    let applied = 0;
    for (const edit of edits) {
      if (content.includes(edit.old_str)) {
        content = content.replace(edit.old_str, edit.new_str);
        applied++;
      }
    }
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath, edits_applied: applied, total_edits: edits.length };
  },
});

registerTool({
  name: 'code.create_file',
  description: 'Create a new code file',
  category: 'code',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: filePath, content } = input as { path: string; content: string };
    const safePath = validatePath(filePath);
    if (fs.existsSync(safePath)) throw new Error(`File already exists: ${safePath}`);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath, created: true };
  },
});

registerTool({
  name: 'code.delete_file',
  description: 'Delete a code file',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    fs.unlinkSync(safePath);
    return { success: true, path: safePath, deleted: true };
  },
});

registerTool({
  name: 'code.rename_file',
  description: 'Rename a code file',
  category: 'code',
  schema: z.object({ old_path: z.string(), new_path: z.string() }),
  handler: async (input) => {
    const { old_path, new_path } = input as { old_path: string; new_path: string };
    const safeOld = validatePath(old_path);
    const safeNew = validatePath(new_path);
    fs.renameSync(safeOld, safeNew);
    return { success: true, old_path: safeOld, new_path: safeNew };
  },
});

registerTool({
  name: 'code.apply_patch',
  description: 'Apply a patch to code',
  category: 'code',
  schema: z.object({ file: z.string(), patch: z.string() }),
  handler: async (input) => {
    const { file, patch } = input as { file: string; patch: string };
    const safePath = validatePath(file);
    const tmpPatch = `/tmp/code-patch-${Date.now()}.patch`;
    fs.writeFileSync(tmpPatch, patch);
    const result = await runSandboxed('patch', [safePath, tmpPatch], { timeout: 10000, cwd: '/tmp' });
    try { fs.unlinkSync(tmpPatch); } catch { /* ignore */ }
    return { success: result.exitCode === 0, file: safePath };
  },
});

registerTool({
  name: 'code.generate_patch',
  description: 'Generate a patch between two code versions',
  category: 'code',
  schema: z.object({ original: z.string(), modified: z.string() }),
  handler: async (input) => {
    const { original, modified } = input as { original: string; modified: string };
    const tmpA = `/tmp/orig-${Date.now()}.txt`;
    const tmpB = `/tmp/mod-${Date.now()}.txt`;
    fs.writeFileSync(tmpA, original);
    fs.writeFileSync(tmpB, modified);
    const result = await runSandboxed('diff', ['-u', tmpA, tmpB], { timeout: 10000, cwd: '/tmp' });
    try { fs.unlinkSync(tmpA); fs.unlinkSync(tmpB); } catch { /* ignore */ }
    return { patch: result.stdout };
  },
});

registerTool({
  name: 'code.get_diff',
  description: 'Get diff of a file against its git version',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const result = await runSandboxed('git', ['diff', safePath], { timeout: 10000, cwd: path.dirname(safePath) });
    return { path: safePath, diff: result.stdout };
  },
});

registerTool({
  name: 'code.review_diff',
  description: 'Review a code diff',
  category: 'code',
  schema: z.object({ diff: z.string() }),
  handler: async (input) => {
    const { diff } = input as { diff: string };
    const lines = diff.split('\n');
    const added = lines.filter(l => l.startsWith('+')).length;
    const removed = lines.filter(l => l.startsWith('-')).length;
    return { diff_lines: lines.length, added, removed, review: 'Configure AI for detailed review' };
  },
});

registerTool({
  name: 'code.format_file',
  description: 'Format a code file using the appropriate formatter',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const ext = path.extname(safePath);
    let result;
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      result = await runSandboxed('npx', ['prettier', '--write', safePath], { timeout: 30000, cwd: path.dirname(safePath) });
    } else if (ext === '.py') {
      result = await runSandboxed('black', [safePath], { timeout: 30000, cwd: path.dirname(safePath) });
    } else {
      return { formatted: false, path: safePath, message: `No formatter for ${ext}` };
    }
    return { formatted: result.exitCode === 0, path: safePath };
  },
});

registerTool({
  name: 'code.lint_file',
  description: 'Lint a code file',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const ext = path.extname(safePath);
    let result;
    if (['.ts', '.js'].includes(ext)) {
      result = await runSandboxed('npx', ['eslint', safePath, '--format', 'json'], { timeout: 30000, cwd: path.dirname(safePath) });
      try {
        const lintResult = JSON.parse(result.stdout);
        return { path: safePath, issues: lintResult[0]?.messages || [] };
      } catch { /* ignore */ }
    }
    return { path: safePath, issues: [] };
  },
});

registerTool({
  name: 'code.refactor',
  description: 'Suggest code refactoring improvements',
  category: 'code',
  schema: z.object({ path: z.string(), goal: z.string().optional() }),
  handler: async (input) => {
    const { path: filePath, goal } = input as { path: string; goal?: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    return { path: safePath, goal, suggestions: [], message: 'Configure AI for refactoring suggestions' };
  },
});

registerTool({
  name: 'code.fix_bug',
  description: 'Fix a bug in code',
  category: 'code',
  schema: z.object({ path: z.string(), bug_description: z.string() }),
  handler: async (input) => {
    const { path: filePath, bug_description } = input as { path: string; bug_description: string };
    const safePath = validatePath(filePath);
    return { path: safePath, bug_description, fix: null, message: 'Configure AI for bug fixes' };
  },
});

registerTool({
  name: 'code.implement_feature',
  description: 'Implement a feature in code',
  category: 'code',
  schema: z.object({ path: z.string(), feature_description: z.string() }),
  handler: async (input) => {
    const { path: filePath, feature_description } = input as { path: string; feature_description: string };
    const safePath = validatePath(filePath);
    return { path: safePath, feature_description, implementation: null, message: 'Configure AI for feature implementation' };
  },
});

registerTool({
  name: 'code.generate_tests',
  description: 'Generate unit tests for code',
  category: 'code',
  schema: z.object({ path: z.string(), framework: z.string().optional() }),
  handler: async (input) => {
    const { path: filePath, framework = 'jest' } = input as { path: string; framework?: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    return { path: safePath, framework, tests: null, message: 'Configure AI for test generation' };
  },
});

registerTool({
  name: 'code.update_tests',
  description: 'Update existing tests to match code changes',
  category: 'code',
  schema: z.object({ test_path: z.string(), source_path: z.string() }),
  handler: async (input) => {
    const { test_path, source_path } = input as { test_path: string; source_path: string };
    return { test_path, source_path, updated: false, message: 'Configure AI for test updates' };
  },
});

registerTool({
  name: 'code.explain_file',
  description: 'Explain what a code file does',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    const lines = content.split('\n').length;
    const ext = path.extname(safePath);
    return {
      path: safePath,
      line_count: lines,
      extension: ext,
      explanation: `This is a ${ext} file with ${lines} lines. Configure AI for detailed explanation.`,
    };
  },
});

registerTool({
  name: 'code.explain_symbol',
  description: 'Explain a code symbol (function, class, variable)',
  category: 'code',
  schema: z.object({ path: z.string(), symbol: z.string() }),
  handler: async (input) => {
    const { path: filePath, symbol } = input as { path: string; symbol: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    const lines = content.split('\n');
    const lineIdx = lines.findIndex(l => l.includes(symbol));
    return {
      path: safePath,
      symbol,
      found_at_line: lineIdx + 1,
      context: lineIdx >= 0 ? lines.slice(Math.max(0, lineIdx - 2), lineIdx + 5).join('\n') : null,
    };
  },
});

registerTool({
  name: 'code.find_dead_code',
  description: 'Find unused code in a file or project',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: dirPath } = input as { path: string };
    return { path: dirPath, dead_code: [], message: 'Use ts-unused-exports or similar tool for dead code detection' };
  },
});

registerTool({
  name: 'code.find_security_issues',
  description: 'Find security issues in code',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    const issues: string[] = [];
    const patterns = [
      { pattern: /eval\(/, message: 'Potential code injection via eval()' },
      { pattern: /exec\(/, message: 'Potential command injection via exec()' },
      { pattern: /innerHTML\s*=/, message: 'Potential XSS via innerHTML' },
    ];
    for (const { pattern, message } of patterns) {
      if (pattern.test(content)) issues.push(message);
    }
    return { path: safePath, security_issues: issues, count: issues.length };
  },
});

registerTool({
  name: 'code.find_performance_issues',
  description: 'Find performance issues in code',
  category: 'code',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    return { path: safePath, performance_issues: [], message: 'Configure profiling tools for performance analysis' };
  },
});

registerTool({
  name: 'code.migrate_api',
  description: 'Migrate from one API to another',
  category: 'code',
  schema: z.object({ path: z.string(), from_api: z.string(), to_api: z.string() }),
  handler: async (input) => {
    const { path: filePath, from_api, to_api } = input as { path: string; from_api: string; to_api: string };
    const safePath = validatePath(filePath);
    return { path: safePath, from_api, to_api, migrated: false, message: 'Configure AI for API migration' };
  },
});

registerTool({
  name: 'code.upgrade_dependency',
  description: 'Upgrade a dependency and fix breaking changes',
  category: 'code',
  schema: z.object({ cwd: z.string(), dependency: z.string(), version: z.string() }),
  handler: async (input) => {
    const { cwd, dependency, version } = input as { cwd: string; dependency: string; version: string };
    const result = await runSandboxed('npm', ['install', `${dependency}@${version}`], { timeout: 120000, cwd });
    return { success: result.exitCode === 0, dependency, version, cwd };
  },
});

registerTool({
  name: 'code.scaffold_project',
  description: 'Scaffold a new project',
  category: 'code',
  schema: z.object({
    type: z.enum(['react', 'nextjs', 'express', 'fastify', 'python-flask', 'python-fastapi']),
    name: z.string(),
    destination: z.string(),
  }),
  handler: async (input) => {
    const { type, name, destination } = input as { type: string; name: string; destination: string };
    const commands: Record<string, { cmd: string; args: string[] }> = {
      react: { cmd: 'npx', args: ['create-react-app', name] },
      nextjs: { cmd: 'npx', args: ['create-next-app', name] },
      express: { cmd: 'npx', args: ['express-generator', name] },
    };
    const cmdInfo = commands[type];
    if (!cmdInfo) return { message: `Scaffold for ${type} not configured` };
    const result = await runSandboxed(cmdInfo.cmd, cmdInfo.args, { timeout: 120000, cwd: destination });
    return { success: result.exitCode === 0, type, name, destination };
  },
});
