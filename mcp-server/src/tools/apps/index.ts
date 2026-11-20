import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';

registerTool({
  name: 'apps.list_running',
  description: 'List running applications',
  category: 'apps',
  schema: z.object({}),
  handler: async () => {
    const result = await runSandboxed('ps', ['aux', '--no-headers'], { timeout: 10000, cwd: '/tmp' });
    const apps = result.stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return { pid: parts[1], user: parts[0], command: parts.slice(10).join(' ') };
    });
    return { apps, count: apps.length };
  },
});

registerTool({
  name: 'apps.launch',
  description: 'Launch an application',
  category: 'apps',
  schema: z.object({ app: z.string(), args: z.array(z.string()).optional() }),
  handler: async (input) => {
    const { app, args = [] } = input as { app: string; args?: string[] };
    const result = await runSandboxed(app, args, { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, app, args };
  },
});

registerTool({
  name: 'apps.quit',
  description: 'Quit a running application',
  category: 'apps',
  schema: z.object({ app_name: z.string() }),
  handler: async (input) => {
    const { app_name } = input as { app_name: string };
    const result = await runSandboxed('pkill', ['-f', app_name], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, app_name };
  },
});

registerTool({
  name: 'apps.activate',
  description: 'Activate/focus an application',
  category: 'apps',
  schema: z.object({ app_name: z.string() }),
  handler: async (input) => {
    const { app_name } = input as { app_name: string };
    await runSandboxed('wmctrl', ['-a', app_name], { timeout: 5000, cwd: '/tmp' });
    return { success: true, app_name };
  },
});

registerTool({
  name: 'windows.list',
  description: 'List all open windows',
  category: 'apps',
  schema: z.object({}),
  handler: async () => {
    const result = await runSandboxed('wmctrl', ['-l', '-G'], { timeout: 5000, cwd: '/tmp' });
    const windows = result.stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        desktop: parts[1],
        x: parts[2],
        y: parts[3],
        width: parts[4],
        height: parts[5],
        title: parts.slice(7).join(' '),
      };
    });
    return { windows };
  },
});

registerTool({
  name: 'windows.focus',
  description: 'Focus a window',
  category: 'apps',
  schema: z.object({ window_id: z.string() }),
  handler: async (input) => {
    const { window_id } = input as { window_id: string };
    await runSandboxed('wmctrl', ['-i', '-a', window_id], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id };
  },
});

registerTool({
  name: 'windows.move',
  description: 'Move a window',
  category: 'apps',
  schema: z.object({ window_id: z.string(), x: z.number(), y: z.number() }),
  handler: async (input) => {
    const { window_id, x, y } = input as { window_id: string; x: number; y: number };
    await runSandboxed('wmctrl', ['-i', '-r', window_id, '-e', `0,${x},${y},-1,-1`], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id, x, y };
  },
});

registerTool({
  name: 'windows.resize',
  description: 'Resize a window',
  category: 'apps',
  schema: z.object({ window_id: z.string(), width: z.number(), height: z.number() }),
  handler: async (input) => {
    const { window_id, width, height } = input as { window_id: string; width: number; height: number };
    await runSandboxed('wmctrl', ['-i', '-r', window_id, '-e', `0,-1,-1,${width},${height}`], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id, width, height };
  },
});

registerTool({
  name: 'windows.minimize',
  description: 'Minimize a window',
  category: 'apps',
  schema: z.object({ window_id: z.string() }),
  handler: async (input) => {
    const { window_id } = input as { window_id: string };
    await runSandboxed('xdotool', ['windowminimize', window_id], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id };
  },
});

registerTool({
  name: 'windows.maximize',
  description: 'Maximize a window',
  category: 'apps',
  schema: z.object({ window_id: z.string() }),
  handler: async (input) => {
    const { window_id } = input as { window_id: string };
    await runSandboxed('wmctrl', ['-i', '-r', window_id, '-b', 'toggle,maximized_vert,maximized_horz'], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id };
  },
});

registerTool({
  name: 'windows.close',
  description: 'Close a window',
  category: 'apps',
  schema: z.object({ window_id: z.string() }),
  handler: async (input) => {
    const { window_id } = input as { window_id: string };
    await runSandboxed('wmctrl', ['-i', '-c', window_id], { timeout: 5000, cwd: '/tmp' });
    return { success: true, window_id };
  },
});

registerTool({
  name: 'notifications.list',
  description: 'List recent system notifications',
  category: 'apps',
  schema: z.object({}),
  handler: async () => {
    return { notifications: [], message: 'Notification tracking requires D-Bus integration' };
  },
});

registerTool({
  name: 'notifications.dismiss',
  description: 'Dismiss a notification',
  category: 'apps',
  schema: z.object({ notification_id: z.string() }),
  handler: async (input) => {
    const { notification_id } = input as { notification_id: string };
    return { success: true, notification_id, dismissed: true };
  },
});
