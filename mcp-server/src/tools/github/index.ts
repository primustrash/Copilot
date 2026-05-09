import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import axios from 'axios';

function githubAPI(endpoint: string) {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `token ${config.github.token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
}

function gh() {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `token ${config.github.token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
}

const repoSchema = z.object({ owner: z.string(), repo: z.string() });

registerTool({
  name: 'github.get_issue',
  description: 'Get a GitHub issue',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), issue_number: z.number() }),
  handler: async (input) => {
    const { owner, repo, issue_number } = input as { owner: string; repo: string; issue_number: number };
    const response = await gh().get(`/repos/${owner}/${repo}/issues/${issue_number}`);
    return response.data;
  },
});

registerTool({
  name: 'github.list_issues',
  description: 'List GitHub issues',
  category: 'github',
  schema: z.object({
    owner: z.string(),
    repo: z.string(),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().optional(),
  }),
  handler: async (input) => {
    const { owner, repo, state = 'open', per_page = 30 } = input as {
      owner: string; repo: string; state?: string; per_page?: number;
    };
    const response = await gh().get(`/repos/${owner}/${repo}/issues`, { params: { state, per_page } });
    return { issues: response.data, count: response.data.length };
  },
});

registerTool({
  name: 'github.create_issue',
  description: 'Create a GitHub issue',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(),
    title: z.string(), body: z.string().optional(),
    labels: z.array(z.string()).optional(),
  }),
  handler: async (input) => {
    const { owner, repo, title, body, labels } = input as {
      owner: string; repo: string; title: string; body?: string; labels?: string[];
    };
    const response = await gh().post(`/repos/${owner}/${repo}/issues`, { title, body, labels });
    return response.data;
  },
});

registerTool({
  name: 'github.update_issue',
  description: 'Update a GitHub issue',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(), issue_number: z.number(),
    title: z.string().optional(), body: z.string().optional(),
    state: z.enum(['open', 'closed']).optional(),
  }),
  handler: async (input) => {
    const { owner, repo, issue_number, ...updates } = input as {
      owner: string; repo: string; issue_number: number; title?: string; body?: string; state?: string;
    };
    const response = await gh().patch(`/repos/${owner}/${repo}/issues/${issue_number}`, updates);
    return response.data;
  },
});

registerTool({
  name: 'github.comment_issue',
  description: 'Comment on a GitHub issue',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), issue_number: z.number(), body: z.string() }),
  handler: async (input) => {
    const { owner, repo, issue_number, body } = input as {
      owner: string; repo: string; issue_number: number; body: string;
    };
    const response = await gh().post(`/repos/${owner}/${repo}/issues/${issue_number}/comments`, { body });
    return response.data;
  },
});

registerTool({
  name: 'github.get_pull_request',
  description: 'Get a GitHub pull request',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), pull_number: z.number() }),
  handler: async (input) => {
    const { owner, repo, pull_number } = input as { owner: string; repo: string; pull_number: number };
    const response = await gh().get(`/repos/${owner}/${repo}/pulls/${pull_number}`);
    return response.data;
  },
});

registerTool({
  name: 'github.list_pull_requests',
  description: 'List GitHub pull requests',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().optional(),
  }),
  handler: async (input) => {
    const { owner, repo, state = 'open', per_page = 30 } = input as {
      owner: string; repo: string; state?: string; per_page?: number;
    };
    const response = await gh().get(`/repos/${owner}/${repo}/pulls`, { params: { state, per_page } });
    return { pulls: response.data, count: response.data.length };
  },
});

registerTool({
  name: 'github.create_pull_request',
  description: 'Create a GitHub pull request',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(),
    title: z.string(), body: z.string().optional(),
    head: z.string(), base: z.string(),
    draft: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { owner, repo, title, body, head, base, draft } = input as {
      owner: string; repo: string; title: string; body?: string; head: string; base: string; draft?: boolean;
    };
    const response = await gh().post(`/repos/${owner}/${repo}/pulls`, { title, body, head, base, draft });
    return response.data;
  },
});

registerTool({
  name: 'github.update_pull_request',
  description: 'Update a GitHub pull request',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(), pull_number: z.number(),
    title: z.string().optional(), body: z.string().optional(),
    state: z.enum(['open', 'closed']).optional(),
  }),
  handler: async (input) => {
    const { owner, repo, pull_number, ...updates } = input as {
      owner: string; repo: string; pull_number: number; title?: string; body?: string; state?: string;
    };
    const response = await gh().patch(`/repos/${owner}/${repo}/pulls/${pull_number}`, updates);
    return response.data;
  },
});

registerTool({
  name: 'github.comment_pull_request',
  description: 'Comment on a GitHub pull request',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), pull_number: z.number(), body: z.string() }),
  handler: async (input) => {
    const { owner, repo, pull_number, body } = input as {
      owner: string; repo: string; pull_number: number; body: string;
    };
    const response = await gh().post(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, { body });
    return response.data;
  },
});

registerTool({
  name: 'github.review_pull_request',
  description: 'Submit a review on a pull request',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(), pull_number: z.number(),
    event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
    body: z.string().optional(),
  }),
  handler: async (input) => {
    const { owner, repo, pull_number, event, body } = input as {
      owner: string; repo: string; pull_number: number; event: string; body?: string;
    };
    const response = await gh().post(`/repos/${owner}/${repo}/pulls/${pull_number}/reviews`, { event, body });
    return response.data;
  },
});

registerTool({
  name: 'github.merge_pull_request',
  description: 'Merge a GitHub pull request',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(), pull_number: z.number(),
    merge_method: z.enum(['merge', 'squash', 'rebase']).optional(),
    commit_message: z.string().optional(),
  }),
  handler: async (input) => {
    const { owner, repo, pull_number, merge_method = 'merge', commit_message } = input as {
      owner: string; repo: string; pull_number: number; merge_method?: string; commit_message?: string;
    };
    const response = await gh().put(`/repos/${owner}/${repo}/pulls/${pull_number}/merge`, {
      merge_method,
      commit_message,
    });
    return response.data;
  },
});

registerTool({
  name: 'github.get_actions',
  description: 'Get GitHub Actions workflows',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string() }),
  handler: async (input) => {
    const { owner, repo } = input as { owner: string; repo: string };
    const response = await gh().get(`/repos/${owner}/${repo}/actions/workflows`);
    return response.data;
  },
});

registerTool({
  name: 'github.run_workflow',
  description: 'Trigger a GitHub Actions workflow',
  category: 'github',
  schema: z.object({
    owner: z.string(), repo: z.string(),
    workflow_id: z.string(),
    ref: z.string(),
    inputs: z.record(z.string()).optional(),
  }),
  handler: async (input) => {
    const { owner, repo, workflow_id, ref, inputs = {} } = input as {
      owner: string; repo: string; workflow_id: string; ref: string; inputs?: Record<string, string>;
    };
    await gh().post(`/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, { ref, inputs });
    return { success: true, workflow_id, ref };
  },
});

registerTool({
  name: 'github.get_workflow_status',
  description: 'Get GitHub Actions workflow run status',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), run_id: z.number() }),
  handler: async (input) => {
    const { owner, repo, run_id } = input as { owner: string; repo: string; run_id: number };
    const response = await gh().get(`/repos/${owner}/${repo}/actions/runs/${run_id}`);
    return response.data;
  },
});

registerTool({
  name: 'github.get_check_runs',
  description: 'Get check runs for a commit',
  category: 'github',
  schema: z.object({ owner: z.string(), repo: z.string(), ref: z.string() }),
  handler: async (input) => {
    const { owner, repo, ref } = input as { owner: string; repo: string; ref: string };
    const response = await gh().get(`/repos/${owner}/${repo}/commits/${ref}/check-runs`);
    return response.data;
  },
});
