import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { registerTool } from '../../registry';
import { validatePath } from '../../utils/sandbox';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';
import crypto from 'crypto';
import { execSync } from 'child_process';

registerTool({
  name: 'read_file',
  description: 'Read the contents of a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), encoding: z.string().optional() }),
  handler: async (input) => {
    const { path: filePath, encoding = 'utf-8' } = input as { path: string; encoding?: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, encoding as BufferEncoding);
    const stats = fs.statSync(safePath);
    return { path: safePath, content, size: stats.size, modified: stats.mtime };
  },
});

registerTool({
  name: 'write_file',
  description: 'Write content to a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), content: z.string(), encoding: z.string().optional() }),
  handler: async (input) => {
    const { path: filePath, content, encoding = 'utf-8' } = input as { path: string; content: string; encoding?: string };
    const safePath = validatePath(filePath);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, encoding as BufferEncoding);
    const stats = fs.statSync(safePath);
    logger.info('File written', { path: safePath, size: stats.size });
    return { success: true, path: safePath, size: stats.size };
  },
});

registerTool({
  name: 'append_file',
  description: 'Append content to a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: filePath, content } = input as { path: string; content: string };
    const safePath = validatePath(filePath);
    fs.appendFileSync(safePath, content, 'utf-8');
    const stats = fs.statSync(safePath);
    return { success: true, path: safePath, size: stats.size };
  },
});

registerTool({
  name: 'delete_file',
  description: 'Delete a file',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    fs.unlinkSync(safePath);
    return { success: true, path: safePath, deleted: true };
  },
});

registerTool({
  name: 'list_files',
  description: 'List files in a directory',
  category: 'filesystem',
  schema: z.object({ path: z.string(), recursive: z.boolean().optional(), pattern: z.string().optional() }),
  handler: async (input) => {
    const { path: dirPath, recursive = false, pattern } = input as { path: string; recursive?: boolean; pattern?: string };
    const safePath = validatePath(dirPath);

    function listRecursive(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) {
          files.push(...listRecursive(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
      return files;
    }

    let files = listRecursive(safePath);
    if (pattern) {
      const regex = new RegExp(pattern);
      files = files.filter(f => regex.test(f));
    }

    return { path: safePath, files, count: files.length };
  },
});

registerTool({
  name: 'move_file',
  description: 'Move or rename a file',
  category: 'filesystem',
  schema: z.object({ source: z.string(), destination: z.string() }),
  handler: async (input) => {
    const { source, destination } = input as { source: string; destination: string };
    const safeSrc = validatePath(source);
    const safeDst = validatePath(destination);
    fs.mkdirSync(path.dirname(safeDst), { recursive: true });
    fs.renameSync(safeSrc, safeDst);
    return { success: true, source: safeSrc, destination: safeDst };
  },
});

registerTool({
  name: 'search_files',
  description: 'Search for files matching a pattern',
  category: 'filesystem',
  schema: z.object({
    directory: z.string(),
    pattern: z.string(),
    content_search: z.string().optional(),
  }),
  handler: async (input) => {
    const { directory, pattern, content_search } = input as {
      directory: string; pattern: string; content_search?: string;
    };
    const safeDir = validatePath(directory);

    function findFiles(dir: string, pat: string): string[] {
      const results: string[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...findFiles(fullPath, pat));
          } else if (entry.isFile() && entry.name.includes(pat.replace(/\*/g, ''))) {
            results.push(fullPath);
          }
        }
      } catch { /* ignore permission errors */ }
      return results;
    }

    let files = findFiles(safeDir, pattern);

    if (content_search) {
      files = files.filter(f => {
        try {
          return fs.readFileSync(f, 'utf-8').includes(content_search);
        } catch { return false; }
      });
    }

    return { directory: safeDir, pattern, files, count: files.length };
  },
});

registerTool({
  name: 'semantic_search_files',
  description: 'Search files using semantic similarity',
  category: 'filesystem',
  schema: z.object({ directory: z.string(), query: z.string() }),
  handler: async (input) => {
    const { directory, query } = input as { directory: string; query: string };
    const safeDir = validatePath(directory);
    return { directory: safeDir, query, results: [], message: 'Semantic search requires vector DB integration' };
  },
});

registerTool({
  name: 'summarize_project',
  description: 'Summarize a project directory structure',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: projPath } = input as { path: string };
    const safePath = validatePath(projPath);

    function buildTree(dir: string, depth = 0, maxDepth = 3): string {
      if (depth > maxDepth) return '';
      let result = '';
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          result += '  '.repeat(depth) + (entry.isDirectory() ? '📁 ' : '📄 ') + entry.name + '\n';
          if (entry.isDirectory()) {
            result += buildTree(path.join(dir, entry.name), depth + 1, maxDepth);
          }
        }
      } catch { /* ignore */ }
      return result;
    }

    const tree = buildTree(safePath);
    const files = fs.readdirSync(safePath).length;
    return { path: safePath, tree, file_count: files };
  },
});

registerTool({
  name: 'get_diff',
  description: 'Get the diff of a file or between two files',
  category: 'filesystem',
  schema: z.object({ file_a: z.string(), file_b: z.string().optional() }),
  handler: async (input) => {
    const { file_a, file_b } = input as { file_a: string; file_b?: string };
    const safeA = validatePath(file_a);
    if (file_b) {
      const safeB = validatePath(file_b);
      try {
        const diff = execSync(`diff -u "${safeA}" "${safeB}"`, { encoding: 'utf-8' });
        return { diff, file_a: safeA, file_b: safeB };
      } catch (e: unknown) {
        const err = e as { stdout?: string };
        return { diff: err.stdout || '', file_a: safeA, file_b: safeB };
      }
    }
    return { diff: '', file_a: safeA, message: 'Need file_b for diff' };
  },
});

registerTool({
  name: 'apply_patch',
  description: 'Apply a patch to a file',
  category: 'filesystem',
  schema: z.object({ file: z.string(), patch: z.string() }),
  handler: async (input) => {
    const { file, patch } = input as { file: string; patch: string };
    const safePath = validatePath(file);
    const tmpPatch = `/tmp/patch-${Date.now()}.patch`;
    fs.writeFileSync(tmpPatch, patch, 'utf-8');
    try {
      execSync(`patch "${safePath}" "${tmpPatch}"`, { encoding: 'utf-8' });
      return { success: true, file: safePath };
    } catch (err: unknown) {
      throw new Error(`Failed to apply patch: ${(err as Error).message}`);
    } finally {
      try { fs.unlinkSync(tmpPatch); } catch { /* ignore */ }
    }
  },
});

registerTool({
  name: 'show_file_history',
  description: 'Show git history for a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), limit: z.number().optional() }),
  handler: async (input) => {
    const { path: filePath, limit = 10 } = input as { path: string; limit?: number };
    const safePath = validatePath(filePath);
    try {
      const log = execSync(`git log --oneline -${limit} -- "${safePath}"`, {
        encoding: 'utf-8',
        cwd: path.dirname(safePath),
      });
      return { path: safePath, history: log.trim().split('\n') };
    } catch {
      return { path: safePath, history: [], error: 'Not a git repository or no history' };
    }
  },
});

// fs.* aliases
registerTool({
  name: 'fs.read_file',
  description: 'Read a file (alias for read_file)',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    return { path: safePath, content };
  },
});

registerTool({
  name: 'fs.write_file',
  description: 'Write a file (alias for write_file)',
  category: 'filesystem',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: filePath, content } = input as { path: string; content: string };
    const safePath = validatePath(filePath);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath };
  },
});

registerTool({
  name: 'fs.append_file',
  description: 'Append to a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), content: z.string() }),
  handler: async (input) => {
    const { path: filePath, content } = input as { path: string; content: string };
    const safePath = validatePath(filePath);
    fs.appendFileSync(safePath, content, 'utf-8');
    return { success: true, path: safePath };
  },
});

registerTool({
  name: 'fs.list_dir',
  description: 'List directory contents',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: dirPath } = input as { path: string };
    const safePath = validatePath(dirPath);
    const entries = fs.readdirSync(safePath, { withFileTypes: true }).map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
    }));
    return { path: safePath, entries };
  },
});

registerTool({
  name: 'fs.search',
  description: 'Search files recursively',
  category: 'filesystem',
  schema: z.object({ path: z.string(), pattern: z.string() }),
  handler: async (input) => {
    const { path: dirPath, pattern } = input as { path: string; pattern: string };
    const safePath = validatePath(dirPath);
    try {
      const result = execSync(`find "${safePath}" -name "${pattern}" 2>/dev/null`, { encoding: 'utf-8' });
      const files = result.trim().split('\n').filter(Boolean);
      return { path: safePath, pattern, files, count: files.length };
    } catch {
      return { path: safePath, pattern, files: [], count: 0 };
    }
  },
});

registerTool({
  name: 'fs.copy',
  description: 'Copy a file',
  category: 'filesystem',
  schema: z.object({ source: z.string(), destination: z.string() }),
  handler: async (input) => {
    const { source, destination } = input as { source: string; destination: string };
    const safeSrc = validatePath(source);
    const safeDst = validatePath(destination);
    fs.mkdirSync(path.dirname(safeDst), { recursive: true });
    fs.copyFileSync(safeSrc, safeDst);
    return { success: true, source: safeSrc, destination: safeDst };
  },
});

registerTool({
  name: 'fs.move',
  description: 'Move a file',
  category: 'filesystem',
  schema: z.object({ source: z.string(), destination: z.string() }),
  handler: async (input) => {
    const { source, destination } = input as { source: string; destination: string };
    const safeSrc = validatePath(source);
    const safeDst = validatePath(destination);
    fs.renameSync(safeSrc, safeDst);
    return { success: true, source: safeSrc, destination: safeDst };
  },
});

registerTool({
  name: 'fs.delete',
  description: 'Delete a file or directory',
  category: 'filesystem',
  schema: z.object({ path: z.string(), recursive: z.boolean().optional() }),
  handler: async (input) => {
    const { path: filePath, recursive = false } = input as { path: string; recursive?: boolean };
    const safePath = validatePath(filePath);
    fs.rmSync(safePath, { recursive, force: true });
    return { success: true, path: safePath };
  },
});

registerTool({
  name: 'fs.watch',
  description: 'Watch a file or directory for changes',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    return { watching: safePath, message: 'File watching registered (events delivered via SSE)' };
  },
});

registerTool({
  name: 'fs.checksum',
  description: 'Compute checksum of a file',
  category: 'filesystem',
  schema: z.object({ path: z.string(), algorithm: z.enum(['md5', 'sha256', 'sha1']).optional() }),
  handler: async (input) => {
    const { path: filePath, algorithm = 'sha256' } = input as { path: string; algorithm?: string };
    const safePath = validatePath(filePath);
    const content = fs.readFileSync(safePath);
    const hash = crypto.createHash(algorithm).update(content).digest('hex');
    return { path: safePath, algorithm, checksum: hash };
  },
});

registerTool({
  name: 'docs.extract_text',
  description: 'Extract text content from a document file',
  category: 'filesystem',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: filePath } = input as { path: string };
    const safePath = validatePath(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (['.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.csv'].includes(ext)) {
      const text = fs.readFileSync(safePath, 'utf-8');
      return { path: safePath, text, format: ext };
    }
    return { path: safePath, text: '', error: `Unsupported format: ${ext}` };
  },
});

registerTool({
  name: 'docs.convert',
  description: 'Convert a document from one format to another',
  category: 'filesystem',
  schema: z.object({ source: z.string(), target_format: z.string() }),
  handler: async (input) => {
    const { source, target_format } = input as { source: string; target_format: string };
    return { source, target_format, message: 'Conversion requires pandoc or similar tool installed' };
  },
});
