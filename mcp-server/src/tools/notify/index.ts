import { z } from 'zod';
import axios from 'axios';
import { registerTool } from '../../registry';
import { logger } from '../../utils/logger';

registerTool({
  name: 'notify.webhook',
  description: 'Send a webhook POST request with a JSON payload',
  category: 'notify',
  schema: z.object({
    url: z.string(),
    payload: z.unknown(),
    headers: z.record(z.string()).optional(),
    secret_header: z.string().optional(),
    secret_value: z.string().optional(),
    timeout: z.number().optional(),
  }),
  handler: async (input) => {
    const { url, payload, headers = {}, secret_header, secret_value, timeout = 15000 } = input as {
      url: string; payload: unknown; headers?: Record<string, string>;
      secret_header?: string; secret_value?: string; timeout?: number;
    };

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (secret_header && secret_value) {
      mergedHeaders[secret_header] = secret_value;
    }

    const response = await axios.post(url, payload, {
      headers: mergedHeaders,
      timeout,
      validateStatus: () => true,
    });

    logger.info('notify.webhook', { url, status: response.status });
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      status_text: response.statusText,
    };
  },
});

registerTool({
  name: 'notify.slack',
  description: 'Send a message to a Slack channel via an Incoming Webhook URL',
  category: 'notify',
  schema: z.object({
    webhook_url: z.string(),
    text: z.string(),
    username: z.string().optional(),
    icon_emoji: z.string().optional(),
    channel: z.string().optional(),
    blocks: z.array(z.unknown()).optional(),
    attachments: z.array(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { webhook_url, text, username, icon_emoji, channel, blocks, attachments } = input as {
      webhook_url: string; text: string; username?: string; icon_emoji?: string;
      channel?: string; blocks?: unknown[]; attachments?: unknown[];
    };

    const payload: Record<string, unknown> = { text };
    if (username) payload['username'] = username;
    if (icon_emoji) payload['icon_emoji'] = icon_emoji;
    if (channel) payload['channel'] = channel;
    if (blocks) payload['blocks'] = blocks;
    if (attachments) payload['attachments'] = attachments;

    const response = await axios.post(webhook_url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const success = response.status === 200;
    logger.info('notify.slack', { channel, success });
    return { success, status: response.status, response: response.data };
  },
});

registerTool({
  name: 'notify.discord',
  description: 'Send a message to a Discord channel via a Webhook URL',
  category: 'notify',
  schema: z.object({
    webhook_url: z.string(),
    content: z.string().optional(),
    username: z.string().optional(),
    avatar_url: z.string().optional(),
    embeds: z.array(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { webhook_url, content, username, avatar_url, embeds } = input as {
      webhook_url: string; content?: string; username?: string; avatar_url?: string; embeds?: unknown[];
    };

    const payload: Record<string, unknown> = {};
    if (content) payload['content'] = content;
    if (username) payload['username'] = username;
    if (avatar_url) payload['avatar_url'] = avatar_url;
    if (embeds) payload['embeds'] = embeds;

    const response = await axios.post(webhook_url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const success = response.status >= 200 && response.status < 300;
    logger.info('notify.discord', { success });
    return { success, status: response.status };
  },
});

registerTool({
  name: 'notify.teams',
  description: 'Send a message to Microsoft Teams via an Incoming Webhook',
  category: 'notify',
  schema: z.object({
    webhook_url: z.string(),
    title: z.string().optional(),
    text: z.string(),
    theme_color: z.string().optional(),
    sections: z.array(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { webhook_url, title, text, theme_color = '0078D4', sections } = input as {
      webhook_url: string; title?: string; text: string; theme_color?: string; sections?: unknown[];
    };

    const payload: Record<string, unknown> = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: theme_color,
      summary: title || text.slice(0, 80),
      sections: sections || [{ activityText: text }],
    };
    if (title) payload['title'] = title;

    const response = await axios.post(webhook_url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const success = response.status >= 200 && response.status < 300;
    logger.info('notify.teams', { success });
    return { success, status: response.status };
  },
});

registerTool({
  name: 'notify.generic_alert',
  description: 'Send an alert notification to a configured URL with a standard structure',
  category: 'notify',
  schema: z.object({
    webhook_url: z.string(),
    title: z.string(),
    message: z.string(),
    level: z.enum(['info', 'warning', 'error', 'success']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { webhook_url, title, message, level = 'info', metadata } = input as {
      webhook_url: string; title: string; message: string; level?: string;
      metadata?: Record<string, unknown>;
    };

    const payload = {
      title,
      message,
      level,
      metadata,
      timestamp: new Date().toISOString(),
      source: 'mcp-server',
    };

    const response = await axios.post(webhook_url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const success = response.status >= 200 && response.status < 300;
    logger.info('notify.generic_alert', { title, level, success });
    return { success, status: response.status, payload };
  },
});
