import { z } from 'zod';
import { registerTool } from '../../registry';
import { validatePath } from '../../utils/sandbox';
import { runSandboxed } from '../../utils/sandbox';
import fs from 'fs';
import path from 'path';

registerTool({
  name: 'docs.read_readme',
  description: 'Read the README of a project',
  category: 'docs',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: projPath } = input as { path: string };
    const readmePaths = ['README.md', 'README.rst', 'README.txt', 'readme.md'];
    for (const readme of readmePaths) {
      const fullPath = path.join(projPath, readme);
      if (fs.existsSync(fullPath)) {
        return { path: fullPath, content: fs.readFileSync(fullPath, 'utf-8') };
      }
    }
    return { path: projPath, content: null, error: 'README not found' };
  },
});

registerTool({
  name: 'docs.update_readme',
  description: 'Update or create a README file',
  category: 'docs',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: projPath, content } = input as { path: string; content: string };
    const readmePath = path.join(projPath, 'README.md');
    fs.writeFileSync(readmePath, content, 'utf-8');
    return { success: true, path: readmePath, bytes: content.length };
  },
});

registerTool({
  name: 'docs.generate_docs',
  description: 'Generate documentation from code',
  category: 'docs',
  schema: z.object({ path: z.string(), format: z.enum(['markdown', 'html', 'json']).optional() }),
  handler: async (input) => {
    const { path: codePath, format = 'markdown' } = input as { path: string; format?: string };
    return {
      path: codePath,
      format,
      message: 'Integrate with JSDoc/TypeDoc for automated documentation generation',
    };
  },
});

registerTool({
  name: 'docs.generate_changelog',
  description: 'Generate a changelog from git log',
  category: 'docs',
  schema: z.object({ cwd: z.string(), since_tag: z.string().optional() }),
  handler: async (input) => {
    const { cwd, since_tag } = input as { cwd: string; since_tag?: string };
    const args = since_tag
      ? ['log', `${since_tag}..HEAD`, '--oneline', '--no-merges']
      : ['log', '--oneline', '-50', '--no-merges'];
    const result = await runSandboxed('git', args, { timeout: 10000, cwd });
    const commits = result.stdout.trim().split('\n').filter(Boolean);
    const changelog = `## Changelog\n\n${commits.map(c => `- ${c}`).join('\n')}`;
    return { changelog, commit_count: commits.length };
  },
});

registerTool({
  name: 'docs.generate_migration_guide',
  description: 'Generate a migration guide between versions',
  category: 'docs',
  schema: z.object({ from_version: z.string(), to_version: z.string(), breaking_changes: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { from_version, to_version, breaking_changes = [] } = input as {
      from_version: string; to_version: string; breaking_changes?: string[];
    };
    const guide = `# Migration Guide: ${from_version} → ${to_version}\n\n## Breaking Changes\n\n${
      breaking_changes.map(c => `- ${c}`).join('\n') || '- No breaking changes'
    }`;
    return { guide, from_version, to_version };
  },
});

registerTool({
  name: 'docs.generate_api_docs',
  description: 'Generate API documentation',
  category: 'docs',
  schema: z.object({ path: z.string(), format: z.enum(['openapi', 'markdown']).optional() }),
  handler: async (input) => {
    const { path: apiPath, format = 'openapi' } = input as { path: string; format?: string };
    return { path: apiPath, format, message: 'API documentation generation requires source code analysis' };
  },
});

registerTool({
  name: 'docs.explain_setup',
  description: 'Explain how to set up a project',
  category: 'docs',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: projPath } = input as { path: string };
    const steps: string[] = [];
    if (fs.existsSync(path.join(projPath, 'package.json'))) {
      steps.push('npm install', 'npm run build', 'npm start');
    } else if (fs.existsSync(path.join(projPath, 'requirements.txt'))) {
      steps.push('pip install -r requirements.txt', 'python main.py');
    } else {
      steps.push('See README.md for setup instructions');
    }
    return { path: projPath, setup_steps: steps };
  },
});

registerTool({
  name: 'docs.extract_requirements',
  description: 'Extract requirements from documentation',
  category: 'docs',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: docPath } = input as { path: string };
    const safePath = validatePath(docPath);
    const content = fs.readFileSync(safePath, 'utf-8');
    const requirements: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(/^[-*]\s+(must|should|shall|require)/i)) {
        requirements.push(line.trim());
      }
    }
    return { path: safePath, requirements, count: requirements.length };
  },
});
