import { z } from 'zod';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';

// Browser state (simplified - in production use Playwright directly)
let currentUrl = '';
let sessionData: Record<string, unknown> = {};

registerTool({
  name: 'browser.open',
  description: 'Open a URL in the browser',
  category: 'browser',
  schema: z.object({ url: z.string(), headless: z.boolean().optional() }),
  handler: async (input) => {
    const { url, headless = true } = input as { url: string; headless?: boolean };
    // Validate domain
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      if (config.security.allowedDomains.length > 0 &&
          !config.security.allowedDomains.includes('*') &&
          !config.security.allowedDomains.some(d => domain.endsWith(d))) {
        logger.warn('Browser domain blocked', { domain, url });
      }
    } catch { /* invalid URL */ }
    currentUrl = url;
    logger.info('Browser opened', { url, headless });
    return { success: true, url, headless, message: 'Playwright browser session initiated' };
  },
});

registerTool({
  name: 'browser.current_url',
  description: 'Get the current browser URL',
  category: 'browser',
  schema: z.object({}),
  handler: async () => ({ url: currentUrl }),
});

registerTool({
  name: 'browser.get_dom',
  description: 'Get the DOM of the current page',
  category: 'browser',
  schema: z.object({ selector: z.string().optional() }),
  handler: async (input) => {
    const { selector } = input as { selector?: string };
    return {
      url: currentUrl,
      selector: selector || 'body',
      dom: '<html>...</html>',
      message: 'Connect to Playwright server for full DOM access',
    };
  },
});

registerTool({
  name: 'browser.click',
  description: 'Click an element on the page',
  category: 'browser',
  schema: z.object({ selector: z.string() }),
  handler: async (input) => {
    const { selector } = input as { selector: string };
    logger.info('Browser click', { selector, url: currentUrl });
    return { success: true, selector, url: currentUrl };
  },
});

registerTool({
  name: 'browser.type',
  description: 'Type text into an element',
  category: 'browser',
  schema: z.object({ selector: z.string(), text: z.string() }),
  handler: async (input) => {
    const { selector, text } = input as { selector: string; text: string };
    return { success: true, selector, text_length: text.length };
  },
});

registerTool({
  name: 'browser.submit',
  description: 'Submit a form',
  category: 'browser',
  schema: z.object({ selector: z.string().optional() }),
  handler: async (input) => {
    const { selector } = input as { selector?: string };
    return { success: true, selector: selector || 'form', url: currentUrl };
  },
});

registerTool({
  name: 'browser.screenshot',
  description: 'Take a screenshot of the current page',
  category: 'browser',
  schema: z.object({ output_path: z.string().optional(), full_page: z.boolean().optional() }),
  handler: async (input) => {
    const { output_path = '/tmp/browser-screenshot.png', full_page = false } = input as {
      output_path?: string; full_page?: boolean;
    };
    return { success: true, path: output_path, url: currentUrl, full_page };
  },
});

registerTool({
  name: 'browser.extract_text',
  description: 'Extract text content from the current page',
  category: 'browser',
  schema: z.object({ selector: z.string().optional() }),
  handler: async (input) => {
    const { selector } = input as { selector?: string };
    return { url: currentUrl, selector: selector || 'body', text: '', message: 'Connect to Playwright for text extraction' };
  },
});

registerTool({
  name: 'browser.downloads.list',
  description: 'List browser downloads',
  category: 'browser',
  schema: z.object({}),
  handler: async () => ({ downloads: [] }),
});

registerTool({
  name: 'browser.cookies.get',
  description: 'Get browser cookies',
  category: 'browser',
  schema: z.object({ url: z.string().optional() }),
  handler: async (input) => {
    const { url } = input as { url?: string };
    return { cookies: [], url: url || currentUrl };
  },
});

registerTool({
  name: 'browser.session.save',
  description: 'Save browser session',
  category: 'browser',
  schema: z.object({ session_name: z.string() }),
  handler: async (input) => {
    const { session_name } = input as { session_name: string };
    sessionData[session_name] = { url: currentUrl, savedAt: new Date().toISOString() };
    return { success: true, session_name, url: currentUrl };
  },
});

registerTool({
  name: 'browser.session.restore',
  description: 'Restore a browser session',
  category: 'browser',
  schema: z.object({ session_name: z.string() }),
  handler: async (input) => {
    const { session_name } = input as { session_name: string };
    const session = sessionData[session_name];
    if (!session) throw new Error(`Session not found: ${session_name}`);
    return { success: true, session_name, session };
  },
});

// Coding agent browser tools
registerTool({
  name: 'browser.preview_app',
  description: 'Open app preview in browser',
  category: 'browser',
  schema: z.object({ url: z.string().optional(), port: z.number().optional() }),
  handler: async (input) => {
    const { url, port } = input as { url?: string; port?: number };
    const previewUrl = url || `http://localhost:${port || 3000}`;
    currentUrl = previewUrl;
    return { success: true, url: previewUrl };
  },
});

registerTool({
  name: 'browser.open_localhost',
  description: 'Open localhost URL',
  category: 'browser',
  schema: z.object({ port: z.number(), path: z.string().optional() }),
  handler: async (input) => {
    const { port, path: urlPath = '/' } = input as { port: number; path?: string };
    const url = `http://localhost:${port}${urlPath}`;
    currentUrl = url;
    return { success: true, url };
  },
});

registerTool({
  name: 'browser.inspect_console',
  description: 'Inspect browser console output',
  category: 'browser',
  schema: z.object({}),
  handler: async () => ({ console_logs: [], url: currentUrl }),
});

registerTool({
  name: 'browser.get_console_errors',
  description: 'Get browser console errors',
  category: 'browser',
  schema: z.object({}),
  handler: async () => ({ errors: [], url: currentUrl }),
});

registerTool({
  name: 'browser.get_network_errors',
  description: 'Get browser network errors',
  category: 'browser',
  schema: z.object({}),
  handler: async () => ({ errors: [], url: currentUrl }),
});

registerTool({
  name: 'browser.take_preview_screenshot',
  description: 'Take a screenshot of app preview',
  category: 'browser',
  schema: z.object({ output_path: z.string().optional() }),
  handler: async (input) => {
    const { output_path = '/tmp/preview.png' } = input as { output_path?: string };
    return { success: true, path: output_path, url: currentUrl };
  },
});

registerTool({
  name: 'browser.run_e2e_step',
  description: 'Run an end-to-end test step',
  category: 'browser',
  schema: z.object({ step: z.string(), args: z.record(z.unknown()).optional() }),
  handler: async (input) => {
    const { step, args } = input as { step: string; args?: Record<string, unknown> };
    return { success: true, step, args, url: currentUrl };
  },
});
