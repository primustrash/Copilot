import { z } from 'zod';
import { registerTool } from '../../registry';
import simpleGit, { SimpleGit } from 'simple-git';

function git(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

const repoSchema = z.object({ cwd: z.string() });

registerTool({
  name: 'git.status',
  description: 'Get git repository status',
  category: 'git',
  schema: z.object({ cwd: z.string() }),
  handler: async (input) => {
    const { cwd } = input as { cwd: string };
    const status = await git(cwd).status();
    return {
      branch: status.current,
      clean: status.isClean(),
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
    };
  },
});

registerTool({
  name: 'git.diff',
  description: 'Get git diff',
  category: 'git',
  schema: z.object({ cwd: z.string(), staged: z.boolean().optional(), file: z.string().optional() }),
  handler: async (input) => {
    const { cwd, staged = false, file } = input as { cwd: string; staged?: boolean; file?: string };
    const args = staged ? ['--staged'] : [];
    if (file) args.push(file);
    const diff = await git(cwd).diff(args);
    return { diff, staged };
  },
});

registerTool({
  name: 'git.branch',
  description: 'List or manage git branches',
  category: 'git',
  schema: z.object({ cwd: z.string(), all: z.boolean().optional() }),
  handler: async (input) => {
    const { cwd, all = false } = input as { cwd: string; all?: boolean };
    const branches = await git(cwd).branch(all ? ['-a'] : []);
    return { current: branches.current, all: branches.all };
  },
});

registerTool({
  name: 'git.checkout',
  description: 'Checkout a branch or file',
  category: 'git',
  schema: z.object({ cwd: z.string(), branch: z.string() }),
  handler: async (input) => {
    const { cwd, branch } = input as { cwd: string; branch: string };
    await git(cwd).checkout(branch);
    return { success: true, branch };
  },
});

registerTool({
  name: 'git.create_branch',
  description: 'Create a new git branch',
  category: 'git',
  schema: z.object({ cwd: z.string(), branch: z.string(), from: z.string().optional() }),
  handler: async (input) => {
    const { cwd, branch, from } = input as { cwd: string; branch: string; from?: string };
    if (from) {
      await git(cwd).checkoutBranch(branch, from);
    } else {
      await git(cwd).checkoutLocalBranch(branch);
    }
    return { success: true, branch, from };
  },
});

registerTool({
  name: 'git.add',
  description: 'Stage files for commit',
  category: 'git',
  schema: z.object({ cwd: z.string(), files: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { cwd, files = ['.'] } = input as { cwd: string; files?: string[] };
    await git(cwd).add(files);
    return { success: true, files };
  },
});

registerTool({
  name: 'git.commit',
  description: 'Commit staged changes',
  category: 'git',
  schema: z.object({ cwd: z.string(), message: z.string(), author: z.string().optional() }),
  handler: async (input) => {
    const { cwd, message, author } = input as { cwd: string; message: string; author?: string };
    const g = git(cwd);
    if (author) {
      await g.addConfig('user.name', author.split('<')[0].trim());
    }
    const result = await g.commit(message);
    return { success: true, commit: result.commit, message };
  },
});

registerTool({
  name: 'git.restore',
  description: 'Restore a file to its last committed state',
  category: 'git',
  schema: z.object({ cwd: z.string(), file: z.string() }),
  handler: async (input) => {
    const { cwd, file } = input as { cwd: string; file: string };
    await git(cwd).checkout(['--', file]);
    return { success: true, file };
  },
});

registerTool({
  name: 'git.stash',
  description: 'Stash current changes',
  category: 'git',
  schema: z.object({ cwd: z.string(), message: z.string().optional(), pop: z.boolean().optional() }),
  handler: async (input) => {
    const { cwd, message, pop = false } = input as { cwd: string; message?: string; pop?: boolean };
    if (pop) {
      await git(cwd).stash(['pop']);
      return { success: true, action: 'pop' };
    }
    const args = message ? ['push', '-m', message] : ['push'];
    await git(cwd).stash(args);
    return { success: true, action: 'push', message };
  },
});

registerTool({
  name: 'git.pull',
  description: 'Pull latest changes',
  category: 'git',
  schema: z.object({ cwd: z.string(), remote: z.string().optional(), branch: z.string().optional() }),
  handler: async (input) => {
    const { cwd, remote = 'origin', branch } = input as { cwd: string; remote?: string; branch?: string };
    const result = await git(cwd).pull(remote, branch);
    return { success: true, summary: result.summary };
  },
});

registerTool({
  name: 'git.push',
  description: 'Push changes to remote',
  category: 'git',
  schema: z.object({ cwd: z.string(), remote: z.string().optional(), branch: z.string().optional(), force: z.boolean().optional() }),
  handler: async (input) => {
    const { cwd, remote = 'origin', branch, force = false } = input as {
      cwd: string; remote?: string; branch?: string; force?: boolean;
    };
    const pushArgs: string[] = [remote];
    if (branch) pushArgs.push(branch);
    if (force) pushArgs.push('--force');
    await git(cwd).push(pushArgs);
    return { success: true, remote, branch };
  },
});

registerTool({
  name: 'git.merge',
  description: 'Merge a branch',
  category: 'git',
  schema: z.object({ cwd: z.string(), branch: z.string(), no_ff: z.boolean().optional() }),
  handler: async (input) => {
    const { cwd, branch, no_ff = false } = input as { cwd: string; branch: string; no_ff?: boolean };
    const options = no_ff ? ['--no-ff'] : [];
    await git(cwd).merge([...options, branch]);
    return { success: true, branch };
  },
});

registerTool({
  name: 'git.rebase',
  description: 'Rebase current branch',
  category: 'git',
  schema: z.object({ cwd: z.string(), onto: z.string() }),
  handler: async (input) => {
    const { cwd, onto } = input as { cwd: string; onto: string };
    await git(cwd).rebase([onto]);
    return { success: true, onto };
  },
});

registerTool({
  name: 'git.log',
  description: 'Get git commit log',
  category: 'git',
  schema: z.object({ cwd: z.string(), limit: z.number().optional(), file: z.string().optional() }),
  handler: async (input) => {
    const { cwd, limit = 20, file } = input as { cwd: string; limit?: number; file?: string };
    const options: Record<string, string | number> = { '--max-count': limit };
    if (file) options['--'] = file;
    const log = await git(cwd).log(options);
    return { commits: log.all, total: log.total };
  },
});

registerTool({
  name: 'git.blame',
  description: 'Get git blame for a file',
  category: 'git',
  schema: z.object({ cwd: z.string(), file: z.string() }),
  handler: async (input) => {
    const { cwd, file } = input as { cwd: string; file: string };
    const { runSandboxed } = await import('../../utils/sandbox');
    const result = await runSandboxed('git', ['blame', file], { timeout: 30000, cwd });
    return { file, blame: result.stdout };
  },
});

registerTool({
  name: 'git.show',
  description: 'Show a git commit or object',
  category: 'git',
  schema: z.object({ cwd: z.string(), ref: z.string() }),
  handler: async (input) => {
    const { cwd, ref } = input as { cwd: string; ref: string };
    const result = await git(cwd).show([ref]);
    return { ref, content: result };
  },
});

registerTool({
  name: 'git.resolve_conflict',
  description: 'Mark a conflict as resolved',
  category: 'git',
  schema: z.object({ cwd: z.string(), file: z.string(), resolution: z.string() }),
  handler: async (input) => {
    const { cwd, file, resolution } = input as { cwd: string; file: string; resolution: string };
    const fs = await import('fs');
    fs.writeFileSync(file, resolution, 'utf-8');
    await git(cwd).add([file]);
    return { success: true, file, resolved: true };
  },
});

registerTool({
  name: 'git.create_worktree',
  description: 'Create a git worktree',
  category: 'git',
  schema: z.object({ cwd: z.string(), path: z.string(), branch: z.string() }),
  handler: async (input) => {
    const { cwd, path: worktreePath, branch } = input as { cwd: string; path: string; branch: string };
    await git(cwd).raw(['worktree', 'add', worktreePath, branch]);
    return { success: true, path: worktreePath, branch };
  },
});

registerTool({
  name: 'git.list_worktrees',
  description: 'List git worktrees',
  category: 'git',
  schema: z.object({ cwd: z.string() }),
  handler: async (input) => {
    const { cwd } = input as { cwd: string };
    const result = await git(cwd).raw(['worktree', 'list', '--porcelain']);
    return { worktrees: result };
  },
});

registerTool({
  name: 'git.remove_worktree',
  description: 'Remove a git worktree',
  category: 'git',
  schema: z.object({ cwd: z.string(), path: z.string() }),
  handler: async (input) => {
    const { cwd, path: worktreePath } = input as { cwd: string; path: string };
    await git(cwd).raw(['worktree', 'remove', worktreePath]);
    return { success: true, path: worktreePath };
  },
});
