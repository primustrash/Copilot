import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';

registerTool({
  name: 'mouse.get_position',
  description: 'Get current mouse cursor position',
  category: 'mouse',
  schema: z.object({}),
  handler: async () => {
    const result = await runSandboxed('xdotool', ['getmouselocation'], { timeout: 5000, cwd: '/tmp' });
    const match = result.stdout.match(/x:(\d+) y:(\d+)/);
    if (match) {
      return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    return { x: 0, y: 0, error: result.stderr };
  },
});

registerTool({
  name: 'mouse.move',
  description: 'Move mouse to absolute position',
  category: 'mouse',
  schema: z.object({ x: z.number(), y: z.number() }),
  handler: async (input) => {
    const { x, y } = input as { x: number; y: number };
    const result = await runSandboxed('xdotool', ['mousemove', String(x), String(y)], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, x, y };
  },
});

registerTool({
  name: 'mouse.move_relative',
  description: 'Move mouse relative to current position',
  category: 'mouse',
  schema: z.object({ dx: z.number(), dy: z.number() }),
  handler: async (input) => {
    const { dx, dy } = input as { dx: number; dy: number };
    const result = await runSandboxed('xdotool', ['mousemove_relative', '--', String(dx), String(dy)], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, dx, dy };
  },
});

registerTool({
  name: 'mouse.click',
  description: 'Click mouse button',
  category: 'mouse',
  schema: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    button: z.number().optional(),
  }),
  handler: async (input) => {
    const { x, y, button = 1 } = input as { x?: number; y?: number; button?: number };
    const args = x !== undefined && y !== undefined
      ? ['mousemove', String(x), String(y), 'click', String(button)]
      : ['click', String(button)];
    const result = await runSandboxed('xdotool', args, { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, x, y, button };
  },
});

registerTool({
  name: 'mouse.double_click',
  description: 'Double-click mouse button',
  category: 'mouse',
  schema: z.object({ x: z.number().optional(), y: z.number().optional() }),
  handler: async (input) => {
    const { x, y } = input as { x?: number; y?: number };
    const args = x !== undefined && y !== undefined
      ? ['mousemove', String(x), String(y), 'click', '--repeat', '2', '1']
      : ['click', '--repeat', '2', '1'];
    const result = await runSandboxed('xdotool', args, { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, x, y };
  },
});

registerTool({
  name: 'mouse.right_click',
  description: 'Right-click at position',
  category: 'mouse',
  schema: z.object({ x: z.number().optional(), y: z.number().optional() }),
  handler: async (input) => {
    const { x, y } = input as { x?: number; y?: number };
    const args = x !== undefined && y !== undefined
      ? ['mousemove', String(x), String(y), 'click', '3']
      : ['click', '3'];
    const result = await runSandboxed('xdotool', args, { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, x, y };
  },
});

registerTool({
  name: 'mouse.drag',
  description: 'Drag from one position to another',
  category: 'mouse',
  schema: z.object({ from_x: z.number(), from_y: z.number(), to_x: z.number(), to_y: z.number() }),
  handler: async (input) => {
    const { from_x, from_y, to_x, to_y } = input as { from_x: number; from_y: number; to_x: number; to_y: number };
    await runSandboxed('xdotool', ['mousemove', String(from_x), String(from_y), 'mousedown', '1'], { timeout: 5000, cwd: '/tmp' });
    await runSandboxed('xdotool', ['mousemove', String(to_x), String(to_y), 'mouseup', '1'], { timeout: 5000, cwd: '/tmp' });
    return { success: true, from_x, from_y, to_x, to_y };
  },
});

registerTool({
  name: 'mouse.scroll',
  description: 'Scroll the mouse wheel',
  category: 'mouse',
  schema: z.object({ direction: z.enum(['up', 'down', 'left', 'right']), amount: z.number().optional() }),
  handler: async (input) => {
    const { direction, amount = 3 } = input as { direction: string; amount?: number };
    const buttonMap: Record<string, number> = { up: 4, down: 5, left: 6, right: 7 };
    const button = buttonMap[direction] || 5;
    for (let i = 0; i < amount; i++) {
      await runSandboxed('xdotool', ['click', String(button)], { timeout: 5000, cwd: '/tmp' });
    }
    return { success: true, direction, amount };
  },
});

registerTool({
  name: 'mouse.hold',
  description: 'Hold a mouse button',
  category: 'mouse',
  schema: z.object({ button: z.number().optional(), x: z.number().optional(), y: z.number().optional() }),
  handler: async (input) => {
    const { button = 1, x, y } = input as { button?: number; x?: number; y?: number };
    if (x !== undefined && y !== undefined) {
      await runSandboxed('xdotool', ['mousemove', String(x), String(y)], { timeout: 5000, cwd: '/tmp' });
    }
    await runSandboxed('xdotool', ['mousedown', String(button)], { timeout: 5000, cwd: '/tmp' });
    return { success: true, button, held: true };
  },
});

registerTool({
  name: 'mouse.release',
  description: 'Release a held mouse button',
  category: 'mouse',
  schema: z.object({ button: z.number().optional() }),
  handler: async (input) => {
    const { button = 1 } = input as { button?: number };
    await runSandboxed('xdotool', ['mouseup', String(button)], { timeout: 5000, cwd: '/tmp' });
    return { success: true, button, released: true };
  },
});

registerTool({
  name: 'mouse.cursor_shape',
  description: 'Get or set the mouse cursor shape',
  category: 'mouse',
  schema: z.object({ shape: z.string().optional() }),
  handler: async (input) => {
    const { shape } = input as { shape?: string };
    return { shape: shape || 'default', message: 'Cursor shape management via X11' };
  },
});
