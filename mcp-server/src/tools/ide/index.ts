import { z } from 'zod';
import { registerTool } from '../../registry';

// IDE integration tools - these emit events to IDE extensions via SSE

registerTool({
  name: 'ide.open_file',
  description: 'Open a file in the IDE',
  category: 'ide',
  schema: z.object({ path: z.string(), line: z.number().optional() }),
  handler: async (input) => {
    const { path: filePath, line } = input as { path: string; line?: number };
    return { action: 'open_file', path: filePath, line, sent_to_ide: true };
  },
});

registerTool({
  name: 'ide.show_diff',
  description: 'Show a diff in the IDE',
  category: 'ide',
  schema: z.object({ diff: z.string(), title: z.string().optional() }),
  handler: async (input) => {
    const { diff, title } = input as { diff: string; title?: string };
    return { action: 'show_diff', diff_lines: diff.split('\n').length, title };
  },
});

registerTool({
  name: 'ide.apply_suggestion',
  description: 'Apply a code suggestion in the IDE',
  category: 'ide',
  schema: z.object({ file: z.string(), old_code: z.string(), new_code: z.string() }),
  handler: async (input) => {
    const { file, old_code, new_code } = input as { file: string; old_code: string; new_code: string };
    const fs = await import('fs');
    const { validatePath } = await import('../../utils/sandbox');
    const safePath = validatePath(file);
    let content = fs.readFileSync(safePath, 'utf-8');
    if (content.includes(old_code)) {
      content = content.replace(old_code, new_code);
      fs.writeFileSync(safePath, content, 'utf-8');
      return { success: true, file, applied: true };
    }
    return { success: false, file, applied: false, error: 'Old code not found' };
  },
});

registerTool({
  name: 'ide.get_selection',
  description: 'Get the current text selection in the IDE',
  category: 'ide',
  schema: z.object({}),
  handler: async () => ({
    selection: null,
    message: 'IDE selection requires active IDE extension connection',
  }),
});

registerTool({
  name: 'ide.replace_selection',
  description: 'Replace the current IDE selection',
  category: 'ide',
  schema: z.object({ text: z.string() }),
  handler: async (input) => {
    const { text } = input as { text: string };
    return { action: 'replace_selection', text_length: text.length, sent_to_ide: true };
  },
});

registerTool({
  name: 'ide.get_diagnostics',
  description: 'Get IDE diagnostics (errors/warnings)',
  category: 'ide',
  schema: z.object({ file: z.string().optional() }),
  handler: async (input) => {
    const { file } = input as { file?: string };
    return { diagnostics: [], file, message: 'Diagnostics require language server integration' };
  },
});

registerTool({
  name: 'ide.goto_definition',
  description: 'Go to definition of a symbol',
  category: 'ide',
  schema: z.object({ file: z.string(), line: z.number(), character: z.number() }),
  handler: async (input) => {
    const { file, line, character } = input as { file: string; line: number; character: number };
    return { action: 'goto_definition', file, line, character, sent_to_ide: true };
  },
});

registerTool({
  name: 'ide.find_references',
  description: 'Find all references to a symbol',
  category: 'ide',
  schema: z.object({ file: z.string(), line: z.number(), character: z.number() }),
  handler: async (input) => {
    const { file, line, character } = input as { file: string; line: number; character: number };
    return { references: [], file, line, character, message: 'References require language server' };
  },
});

registerTool({
  name: 'ide.open_terminal',
  description: 'Open a terminal in the IDE',
  category: 'ide',
  schema: z.object({ cwd: z.string().optional() }),
  handler: async (input) => {
    const { cwd } = input as { cwd?: string };
    return { action: 'open_terminal', cwd: cwd || process.cwd(), sent_to_ide: true };
  },
});

registerTool({
  name: 'ide.run_command',
  description: 'Run an IDE command',
  category: 'ide',
  schema: z.object({ command: z.string(), args: z.record(z.unknown()).optional() }),
  handler: async (input) => {
    const { command, args } = input as { command: string; args?: Record<string, unknown> };
    return { action: 'run_command', command, args, sent_to_ide: true };
  },
});

registerTool({
  name: 'ide.show_notification',
  description: 'Show a notification in the IDE',
  category: 'ide',
  schema: z.object({ message: z.string(), type: z.enum(['info', 'warning', 'error']).optional() }),
  handler: async (input) => {
    const { message, type = 'info' } = input as { message: string; type?: string };
    return { action: 'show_notification', message, type, sent_to_ide: true };
  },
});
