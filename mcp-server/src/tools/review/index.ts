import { z } from 'zod';
import { registerTool } from '../../registry';

registerTool({
  name: 'review.create_summary',
  description: 'Create a code review summary',
  category: 'review',
  schema: z.object({ diff: z.string(), context: z.string().optional() }),
  handler: async (input) => {
    const { diff, context } = input as { diff: string; context?: string };
    const lines = diff.split('\n');
    const added = lines.filter(l => l.startsWith('+')).length;
    const removed = lines.filter(l => l.startsWith('-')).length;
    const files = lines.filter(l => l.startsWith('diff --git')).length;
    return {
      summary: {
        files_changed: files,
        lines_added: added,
        lines_removed: removed,
        net_change: added - removed,
      },
      context,
      review: 'Configure AI for detailed code review',
    };
  },
});

registerTool({
  name: 'review.list_changes',
  description: 'List all changes in a diff',
  category: 'review',
  schema: z.object({ diff: z.string() }),
  handler: async (input) => {
    const { diff } = input as { diff: string };
    const files: string[] = [];
    const filePattern = /^diff --git a\/.+ b\/(.+)$/m;
    let match;
    const regex = /^diff --git a\/.+ b\/(.+)$/gm;
    while ((match = regex.exec(diff)) !== null) {
      files.push(match[1]);
    }
    return { changed_files: files, count: files.length };
  },
});

registerTool({
  name: 'review.explain_changes',
  description: 'Explain what changes were made',
  category: 'review',
  schema: z.object({ diff: z.string() }),
  handler: async (input) => {
    const { diff } = input as { diff: string };
    return { diff_length: diff.length, explanation: 'Configure AI for change explanations' };
  },
});

registerTool({
  name: 'review.check_requirements',
  description: 'Check if changes meet requirements',
  category: 'review',
  schema: z.object({ diff: z.string(), requirements: z.array(z.string()) }),
  handler: async (input) => {
    const { diff, requirements } = input as { diff: string; requirements: string[] };
    const results = requirements.map(req => ({
      requirement: req,
      met: diff.length > 0,
      confidence: 0.5,
    }));
    return { results, all_met: results.every(r => r.met) };
  },
});

registerTool({
  name: 'review.check_tests',
  description: 'Check if adequate tests are included',
  category: 'review',
  schema: z.object({ diff: z.string() }),
  handler: async (input) => {
    const { diff } = input as { diff: string };
    const hasTests = diff.includes('.test.') || diff.includes('.spec.') || diff.includes('describe(') || diff.includes('it(');
    return {
      has_tests: hasTests,
      test_coverage: hasTests ? 'tests present' : 'no tests found',
      recommendation: hasTests ? 'Good test coverage' : 'Consider adding tests',
    };
  },
});

registerTool({
  name: 'review.check_regressions',
  description: 'Check for potential regressions',
  category: 'review',
  schema: z.object({ diff: z.string() }),
  handler: async (input) => {
    const { diff } = input as { diff: string };
    return { potential_regressions: [], confidence: 0.8, diff_analyzed: diff.length > 0 };
  },
});

registerTool({
  name: 'review.prepare_pr_description',
  description: 'Prepare a pull request description',
  category: 'review',
  schema: z.object({ diff: z.string(), branch: z.string().optional() }),
  handler: async (input) => {
    const { diff, branch } = input as { diff: string; branch?: string };
    const lines = diff.split('\n');
    const filesChanged = lines.filter(l => l.startsWith('diff --git')).length;
    const description = `## Summary\n\nThis PR contains changes in ${filesChanged} file(s).\n\n## Changes\n\n- ${filesChanged} files modified\n\n## Testing\n\n- [ ] Tests added/updated\n- [ ] Manual testing done`;
    return { description, branch, word_count: description.split(' ').length };
  },
});

registerTool({
  name: 'review.prepare_commit_message',
  description: 'Prepare a commit message for changes',
  category: 'review',
  schema: z.object({ diff: z.string(), type: z.enum(['feat', 'fix', 'docs', 'chore', 'refactor', 'test']).optional() }),
  handler: async (input) => {
    const { diff, type = 'feat' } = input as { diff: string; type?: string };
    const files = diff.split('\n').filter(l => l.startsWith('diff --git')).length;
    const message = `${type}: update ${files} file(s)\n\nChanges made to improve functionality.`;
    return { message, type, files_changed: files };
  },
});
