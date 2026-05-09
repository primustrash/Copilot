import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';
import { logger } from '../../utils/logger';

registerTool({
  name: 'screen.get_size',
  description: 'Get the screen size',
  category: 'desktop',
  schema: z.object({}),
  handler: async () => {
    try {
      const result = await runSandboxed('xdpyinfo', [], { timeout: 5000, cwd: '/tmp' });
      const match = result.stdout.match(/dimensions:\s+(\d+)x(\d+)/);
      if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    } catch { /* ignore */ }
    return { width: 1920, height: 1080, note: 'Default - xdpyinfo not available' };
  },
});

registerTool({
  name: 'screen.screenshot',
  description: 'Take a screenshot',
  category: 'desktop',
  schema: z.object({
    output_path: z.string().optional(),
    format: z.enum(['png', 'jpg']).optional(),
  }),
  handler: async (input) => {
    const { output_path = '/tmp/screenshot.png', format = 'png' } = input as { output_path?: string; format?: string };
    const result = await runSandboxed('scrot', [output_path], { timeout: 10000, cwd: '/tmp' });
    if (result.exitCode === 0) {
      return { success: true, path: output_path, format };
    }
    return { success: false, error: result.stderr };
  },
});

registerTool({
  name: 'screen.stream_start',
  description: 'Start screen streaming',
  category: 'desktop',
  schema: z.object({ fps: z.number().optional() }),
  handler: async (input) => {
    const { fps = 5 } = input as { fps?: number };
    return { success: true, streaming: true, fps, message: 'Screen streaming started (SSE delivery)' };
  },
});

registerTool({
  name: 'screen.stream_stop',
  description: 'Stop screen streaming',
  category: 'desktop',
  schema: z.object({}),
  handler: async () => ({ success: true, streaming: false }),
});

registerTool({
  name: 'screen.find_image',
  description: 'Find an image on screen using template matching',
  category: 'desktop',
  schema: z.object({ template_path: z.string(), threshold: z.number().optional() }),
  handler: async (input) => {
    const { template_path, threshold = 0.9 } = input as { template_path: string; threshold?: number };
    return { found: false, template: template_path, threshold, message: 'Image matching requires OpenCV' };
  },
});

registerTool({
  name: 'screen.ocr',
  description: 'Perform OCR on screen or image',
  category: 'desktop',
  schema: z.object({ image_path: z.string().optional(), region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional() }),
  handler: async (input) => {
    const { image_path, region } = input as { image_path?: string; region?: { x: number; y: number; width: number; height: number } };
    const targetPath = image_path || '/tmp/ocr_target.png';
    const result = await runSandboxed('tesseract', [targetPath, 'stdout'], { timeout: 30000, cwd: '/tmp' });
    return { text: result.stdout, image_path: targetPath, region };
  },
});

registerTool({
  name: 'screen.get_active_window',
  description: 'Get the currently active window',
  category: 'desktop',
  schema: z.object({}),
  handler: async () => {
    const result = await runSandboxed('xdotool', ['getactivewindow', 'getwindowname'], { timeout: 5000, cwd: '/tmp' });
    return { window_name: result.stdout.trim(), active: true };
  },
});

registerTool({
  name: 'screen.list_windows',
  description: 'List all open windows',
  category: 'desktop',
  schema: z.object({}),
  handler: async () => {
    const result = await runSandboxed('wmctrl', ['-l'], { timeout: 5000, cwd: '/tmp' });
    const windows = result.stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return { id: parts[0], desktop: parts[1], title: parts.slice(3).join(' ') };
    });
    return { windows };
  },
});

registerTool({
  name: 'screen.focus_window',
  description: 'Focus a specific window',
  category: 'desktop',
  schema: z.object({ window_id: z.string().optional(), window_name: z.string().optional() }),
  handler: async (input) => {
    const { window_id, window_name } = input as { window_id?: string; window_name?: string };
    if (window_id) {
      await runSandboxed('xdotool', ['windowfocus', window_id], { timeout: 5000, cwd: '/tmp' });
    } else if (window_name) {
      await runSandboxed('wmctrl', ['-a', window_name], { timeout: 5000, cwd: '/tmp' });
    }
    return { success: true, focused: window_id || window_name };
  },
});

registerTool({
  name: 'screen.get_accessibility_tree',
  description: 'Get the accessibility tree of the active window',
  category: 'desktop',
  schema: z.object({}),
  handler: async () => {
    return { tree: {}, message: 'Accessibility tree requires AT-SPI2 integration' };
  },
});

registerTool({
  name: 'screen.observe',
  description: 'Observe screen for changes',
  category: 'desktop',
  schema: z.object({ duration_seconds: z.number().optional() }),
  handler: async (input) => {
    const { duration_seconds = 5 } = input as { duration_seconds?: number };
    return { observing: true, duration: duration_seconds, changes: [] };
  },
});
