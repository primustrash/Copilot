import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { runSandboxed } from '../../utils/sandbox';
import fs from 'fs';
import path from 'path';

const workspaces = new Map<string, { id: string; path: string; createdAt: string; snapshot?: string }>();
const tasks = new Map<string, { id: string; workspace: string; isolated: boolean }>();

registerTool({
  name: 'workspace.create',
  description: 'Create a new workspace',
  category: 'workspace',
  schema: z.object({ name: z.string(), base_path: z.string().optional() }),
  handler: async (input) => {
    const { name, base_path = config.workspace.root } = input as { name: string; base_path?: string };
    const id = `ws-${Date.now()}`;
    const wsPath = path.join(base_path, id);
    fs.mkdirSync(wsPath, { recursive: true });
    const workspace = { id, path: wsPath, createdAt: new Date().toISOString() };
    workspaces.set(id, workspace);
    return { success: true, workspace };
  },
});

registerTool({
  name: 'workspace.open',
  description: 'Open an existing workspace',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string() }),
  handler: async (input) => {
    const { workspace_id } = input as { workspace_id: string };
    const workspace = workspaces.get(workspace_id);
    if (!workspace) throw new Error(`Workspace not found: ${workspace_id}`);
    return { workspace };
  },
});

registerTool({
  name: 'workspace.snapshot',
  description: 'Take a snapshot of the workspace state',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string() }),
  handler: async (input) => {
    const { workspace_id } = input as { workspace_id: string };
    const workspace = workspaces.get(workspace_id);
    if (!workspace) throw new Error(`Workspace not found: ${workspace_id}`);
    const snapshot = `snapshot-${Date.now()}`;
    workspace.snapshot = snapshot;
    return { success: true, workspace_id, snapshot, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'workspace.restore',
  description: 'Restore a workspace from a snapshot',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string(), snapshot: z.string() }),
  handler: async (input) => {
    const { workspace_id, snapshot } = input as { workspace_id: string; snapshot: string };
    return { success: true, workspace_id, snapshot, restored: true };
  },
});

registerTool({
  name: 'workspace.create_sandbox',
  description: 'Create an isolated sandbox environment',
  category: 'workspace',
  schema: z.object({ name: z.string() }),
  handler: async (input) => {
    const { name } = input as { name: string };
    const id = `sandbox-${Date.now()}`;
    const sandboxPath = path.join(config.workspace.sandboxRoot, id);
    fs.mkdirSync(sandboxPath, { recursive: true });
    return { success: true, sandbox_id: id, path: sandboxPath };
  },
});

registerTool({
  name: 'workspace.destroy_sandbox',
  description: 'Destroy a sandbox environment',
  category: 'workspace',
  schema: z.object({ sandbox_id: z.string() }),
  handler: async (input) => {
    const { sandbox_id } = input as { sandbox_id: string };
    const sandboxPath = path.join(config.workspace.sandboxRoot, sandbox_id);
    fs.rmSync(sandboxPath, { recursive: true, force: true });
    return { success: true, sandbox_id, destroyed: true };
  },
});

registerTool({
  name: 'workspace.sync_repo',
  description: 'Sync a repository into the workspace',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string(), repo_url: z.string() }),
  handler: async (input) => {
    const { workspace_id, repo_url } = input as { workspace_id: string; repo_url: string };
    const workspace = workspaces.get(workspace_id);
    if (!workspace) throw new Error(`Workspace not found: ${workspace_id}`);
    const result = await runSandboxed('git', ['clone', repo_url, '.'], { timeout: 120000, cwd: workspace.path });
    return { success: result.exitCode === 0, workspace_id, repo_url };
  },
});

registerTool({
  name: 'workspace.isolate_task',
  description: 'Isolate a task in a separate workspace',
  category: 'workspace',
  schema: z.object({ task_id: z.string() }),
  handler: async (input) => {
    const { task_id } = input as { task_id: string };
    const id = `ws-task-${Date.now()}`;
    const wsPath = path.join(config.workspace.sandboxRoot, id);
    fs.mkdirSync(wsPath, { recursive: true });
    tasks.set(task_id, { id, workspace: wsPath, isolated: true });
    return { success: true, task_id, workspace_path: wsPath };
  },
});

registerTool({
  name: 'workspace.persist_changes',
  description: 'Persist changes from workspace',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string() }),
  handler: async (input) => {
    const { workspace_id } = input as { workspace_id: string };
    return { success: true, workspace_id, persisted: true, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'workspace.discard_changes',
  description: 'Discard all changes in workspace',
  category: 'workspace',
  schema: z.object({ workspace_id: z.string() }),
  handler: async (input) => {
    const { workspace_id } = input as { workspace_id: string };
    const workspace = workspaces.get(workspace_id);
    if (workspace) {
      const result = await runSandboxed('git', ['checkout', '.'], { timeout: 30000, cwd: workspace.path });
      return { success: result.exitCode === 0, workspace_id };
    }
    return { success: false, workspace_id, error: 'Workspace not found' };
  },
});
