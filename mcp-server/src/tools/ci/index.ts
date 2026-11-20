import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { runSandboxed } from '../../utils/sandbox';
import axios from 'axios';

registerTool({
  name: 'ci.run_tests',
  description: 'Run CI tests',
  category: 'ci',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm test' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { timeout: 300000, cwd });
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
    };
  },
});

registerTool({
  name: 'ci.run_build',
  description: 'Run CI build',
  category: 'ci',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run build' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { timeout: 600000, cwd });
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  },
});

registerTool({
  name: 'ci.get_status',
  description: 'Get CI pipeline status',
  category: 'ci',
  schema: z.object({ owner: z.string(), repo: z.string(), ref: z.string().optional() }),
  handler: async (input) => {
    const { owner, repo, ref = 'main' } = input as { owner: string; repo: string; ref?: string };
    if (!config.github.token) {
      return { status: 'unknown', message: 'GitHub token not configured' };
    }
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/status`,
        { headers: { Authorization: `token ${config.github.token}` } }
      );
      return response.data;
    } catch (err) {
      return { status: 'error', message: (err as Error).message };
    }
  },
});

registerTool({
  name: 'ci.get_logs',
  description: 'Get CI pipeline logs',
  category: 'ci',
  schema: z.object({ owner: z.string(), repo: z.string(), run_id: z.number() }),
  handler: async (input) => {
    const { owner, repo, run_id } = input as { owner: string; repo: string; run_id: number };
    if (!config.github.token) {
      return { logs: '', message: 'GitHub token not configured' };
    }
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/logs`,
      { headers: { Authorization: `token ${config.github.token}` } }
    );
    return { run_id, logs: response.data };
  },
});

registerTool({
  name: 'ci.retry_job',
  description: 'Retry a failed CI job',
  category: 'ci',
  schema: z.object({ owner: z.string(), repo: z.string(), run_id: z.number() }),
  handler: async (input) => {
    const { owner, repo, run_id } = input as { owner: string; repo: string; run_id: number };
    if (!config.github.token) {
      return { success: false, message: 'GitHub token not configured' };
    }
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/rerun`,
      {},
      { headers: { Authorization: `token ${config.github.token}` } }
    );
    return { success: true, run_id };
  },
});

registerTool({
  name: 'ci.cancel_job',
  description: 'Cancel a running CI job',
  category: 'ci',
  schema: z.object({ owner: z.string(), repo: z.string(), run_id: z.number() }),
  handler: async (input) => {
    const { owner, repo, run_id } = input as { owner: string; repo: string; run_id: number };
    if (!config.github.token) {
      return { success: false, message: 'GitHub token not configured' };
    }
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/cancel`,
      {},
      { headers: { Authorization: `token ${config.github.token}` } }
    );
    return { success: true, run_id };
  },
});

registerTool({
  name: 'ci.compare_runs',
  description: 'Compare two CI runs',
  category: 'ci',
  schema: z.object({ owner: z.string(), repo: z.string(), run_id_a: z.number(), run_id_b: z.number() }),
  handler: async (input) => {
    const { owner, repo, run_id_a, run_id_b } = input as {
      owner: string; repo: string; run_id_a: number; run_id_b: number;
    };
    return { owner, repo, run_id_a, run_id_b, comparison: 'Configure CI integration for run comparison' };
  },
});
