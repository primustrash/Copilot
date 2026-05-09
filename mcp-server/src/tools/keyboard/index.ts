import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';

registerTool({
  name: 'keyboard.type',
  description: 'Type text using the keyboard',
  category: 'keyboard',
  schema: z.object({ text: z.string(), delay_ms: z.number().optional() }),
  handler: async (input) => {
    const { text, delay_ms = 0 } = input as { text: string; delay_ms?: number };
    const args = delay_ms > 0 ? ['type', '--delay', String(delay_ms), text] : ['type', text];
    const result = await runSandboxed('xdotool', args, { timeout: 30000, cwd: '/tmp' });
    return { success: result.exitCode === 0, text_length: text.length };
  },
});

registerTool({
  name: 'keyboard.press',
  description: 'Press a keyboard key',
  category: 'keyboard',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    const result = await runSandboxed('xdotool', ['key', key], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, key };
  },
});

registerTool({
  name: 'keyboard.hotkey',
  description: 'Press a keyboard hotkey combination',
  category: 'keyboard',
  schema: z.object({ keys: z.array(z.string()) }),
  handler: async (input) => {
    const { keys } = input as { keys: string[] };
    const combo = keys.join('+');
    const result = await runSandboxed('xdotool', ['key', combo], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, combo };
  },
});

registerTool({
  name: 'keyboard.hold',
  description: 'Hold a keyboard key',
  category: 'keyboard',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    await runSandboxed('xdotool', ['keydown', key], { timeout: 5000, cwd: '/tmp' });
    return { success: true, key, held: true };
  },
});

registerTool({
  name: 'keyboard.release',
  description: 'Release a held keyboard key',
  category: 'keyboard',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    await runSandboxed('xdotool', ['keyup', key], { timeout: 5000, cwd: '/tmp' });
    return { success: true, key, released: true };
  },
});

registerTool({
  name: 'keyboard.shortcut',
  description: 'Execute a keyboard shortcut',
  category: 'keyboard',
  schema: z.object({ shortcut: z.string() }),
  handler: async (input) => {
    const { shortcut } = input as { shortcut: string };
    const result = await runSandboxed('xdotool', ['key', shortcut], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, shortcut };
  },
});

registerTool({
  name: 'clipboard.get',
  description: 'Get clipboard content',
  category: 'keyboard',
  schema: z.object({ selection: z.enum(['clipboard', 'primary']).optional() }),
  handler: async (input) => {
    const { selection = 'clipboard' } = input as { selection?: string };
    const args = selection === 'primary' ? ['-o', '-selection', 'primary'] : ['-o'];
    const result = await runSandboxed('xclip', args, { timeout: 5000, cwd: '/tmp' });
    return { content: result.stdout, selection };
  },
});

registerTool({
  name: 'clipboard.set',
  description: 'Set clipboard content',
  category: 'keyboard',
  schema: z.object({ content: z.string(), selection: z.enum(['clipboard', 'primary']).optional() }),
  handler: async (input) => {
    const { content, selection = 'clipboard' } = input as { content: string; selection?: string };
    const args = selection === 'primary' ? ['-selection', 'primary', '-i'] : ['-selection', 'clipboard', '-i'];
    const result = await runSandboxed('bash', ['-c', `echo -n "${content.replace(/"/g, '\\"')}" | xclip ${args.join(' ')}`], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, content_length: content.length };
  },
});

registerTool({
  name: 'clipboard.clear',
  description: 'Clear clipboard content',
  category: 'keyboard',
  schema: z.object({}),
  handler: async () => {
    await runSandboxed('bash', ['-c', 'echo -n "" | xclip -selection clipboard'], { timeout: 5000, cwd: '/tmp' });
    return { success: true, cleared: true };
  },
});
