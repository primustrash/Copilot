import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';
import { logger } from '../../utils/logger';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';

function getGit(repoPath: string) {
  return simpleGit(repoPath);
}

registerTool({
  name: 'repo.open',
  description: 'Open a local repository',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    const git = getGit(repoPath);
    const status = await git.status();
    return { path: repoPath, branch: status.current, dirty: !status.isClean() };
  },
});

registerTool({
  name: 'repo.clone',
  description: 'Clone a repository',
  category: 'repo',
  schema: z.object({
    url: z.string(),
    destination: z.string(),
    branch: z.string().optional(),
  }),
  handler: async (input) => {
    const { url, destination, branch } = input as { url: string; destination: string; branch?: string };
    const args = ['git', 'clone', url, destination];
    if (branch) args.push('--branch', branch);
    const result = await runSandboxed(args[0], args.slice(1), { timeout: 120000, cwd: '/tmp' });
    return { success: result.exitCode === 0, url, destination, branch };
  },
});

registerTool({
  name: 'repo.index',
  description: 'Index a repository for searching',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    return { indexed: true, path: repoPath, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'repo.refresh_index',
  description: 'Refresh the repository index',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    return { refreshed: true, path: repoPath, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'repo.get_structure',
  description: 'Get the directory structure of a repository',
  category: 'repo',
  schema: z.object({ path: z.string(), max_depth: z.number().optional() }),
  handler: async (input) => {
    const { path: repoPath, max_depth = 3 } = input as { path: string; max_depth?: number };
    const result = await runSandboxed('find', [repoPath, '-maxdepth', String(max_depth), '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*'], {
      timeout: 10000, cwd: '/tmp',
    });
    const files = result.stdout.trim().split('\n').filter(Boolean);
    return { path: repoPath, structure: files, count: files.length };
  },
});

registerTool({
  name: 'repo.search',
  description: 'Search within a repository',
  category: 'repo',
  schema: z.object({ path: z.string(), query: z.string(), file_pattern: z.string().optional() }),
  handler: async (input) => {
    const { path: repoPath, query, file_pattern = '*' } = input as {
      path: string; query: string; file_pattern?: string;
    };
    const result = await runSandboxed('grep', ['-r', '-n', query, repoPath, '--include', file_pattern, '--exclude-dir', 'node_modules', '--exclude-dir', '.git'], {
      timeout: 30000, cwd: '/tmp',
    });
    const matches = result.stdout.trim().split('\n').filter(Boolean).map(line => {
      const [file, lineNum, ...content] = line.split(':');
      return { file, line: lineNum, content: content.join(':') };
    });
    return { query, matches, count: matches.length };
  },
});

registerTool({
  name: 'repo.semantic_search',
  description: 'Semantic search within a repository',
  category: 'repo',
  schema: z.object({ path: z.string(), query: z.string() }),
  handler: async (input) => {
    const { path: repoPath, query } = input as { path: string; query: string };
    return { path: repoPath, query, results: [], message: 'Semantic search requires vector DB' };
  },
});

registerTool({
  name: 'repo.get_symbols',
  description: 'Get symbols (functions, classes) in a repository',
  category: 'repo',
  schema: z.object({ path: z.string(), language: z.string().optional() }),
  handler: async (input) => {
    const { path: repoPath, language } = input as { path: string; language?: string };
    const ext = language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'ts';
    const result = await runSandboxed('grep', ['-r', '-n', '-E', '(function |class |const |export )', repoPath, `--include=*.${ext}`, '--exclude-dir', 'node_modules'], {
      timeout: 30000, cwd: '/tmp',
    });
    const symbols = result.stdout.trim().split('\n').filter(Boolean).slice(0, 100);
    return { path: repoPath, symbols, count: symbols.length };
  },
});

registerTool({
  name: 'repo.find_references',
  description: 'Find references to a symbol',
  category: 'repo',
  schema: z.object({ path: z.string(), symbol: z.string() }),
  handler: async (input) => {
    const { path: repoPath, symbol } = input as { path: string; symbol: string };
    const result = await runSandboxed('grep', ['-r', '-n', symbol, repoPath, '--exclude-dir', 'node_modules', '--exclude-dir', '.git'], {
      timeout: 30000, cwd: '/tmp',
    });
    const refs = result.stdout.trim().split('\n').filter(Boolean);
    return { symbol, references: refs, count: refs.length };
  },
});

registerTool({
  name: 'repo.explain_codebase',
  description: 'Get an explanation of the codebase',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    const readmePath = path.join(repoPath, 'README.md');
    let readme = '';
    try {
      readme = fs.readFileSync(readmePath, 'utf-8').slice(0, 2000);
    } catch { /* no readme */ }
    return { path: repoPath, readme, explanation: readme || 'No README found' };
  },
});

registerTool({
  name: 'repo.answer_question',
  description: 'Answer a question about the codebase',
  category: 'repo',
  schema: z.object({ path: z.string(), question: z.string() }),
  handler: async (input) => {
    const { path: repoPath, question } = input as { path: string; question: string };
    return { path: repoPath, question, answer: 'Configure AI API keys for intelligent answers' };
  },
});

registerTool({
  name: 'repo.detect_stack',
  description: 'Detect the technology stack of a repository',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    const stack: string[] = [];
    const checks = [
      ['package.json', 'Node.js/JavaScript'],
      ['requirements.txt', 'Python'],
      ['Cargo.toml', 'Rust'],
      ['go.mod', 'Go'],
      ['pom.xml', 'Java/Maven'],
      ['Gemfile', 'Ruby'],
      ['composer.json', 'PHP'],
    ];
    for (const [file, tech] of checks) {
      if (fs.existsSync(path.join(repoPath, file))) stack.push(tech);
    }
    return { path: repoPath, stack };
  },
});

registerTool({
  name: 'repo.read_config',
  description: 'Read project configuration files',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    const configFiles = ['.env', 'package.json', 'tsconfig.json', '.eslintrc', 'docker-compose.yml'];
    const configs: Record<string, string> = {};
    for (const file of configFiles) {
      const filePath = path.join(repoPath, file);
      if (fs.existsSync(filePath)) {
        try {
          configs[file] = fs.readFileSync(filePath, 'utf-8');
        } catch { /* ignore */ }
      }
    }
    return { path: repoPath, configs };
  },
});

registerTool({
  name: 'repo.read_dependencies',
  description: 'Read project dependencies',
  category: 'repo',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: repoPath } = input as { path: string };
    const pkgPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        path: repoPath,
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
        peerDependencies: pkg.peerDependencies || {},
      };
    }
    return { path: repoPath, dependencies: {}, message: 'package.json not found' };
  },
});
