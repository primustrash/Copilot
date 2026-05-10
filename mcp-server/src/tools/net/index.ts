import { z } from 'zod';
import axios, { AxiosRequestConfig } from 'axios';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

function isDomainAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return config.security.allowedDomains.some(
      d => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

function buildHeaders(
  headers?: Record<string, string>,
  auth?: { type: string; value: string }
): Record<string, string> {
  const h: Record<string, string> = { ...(headers || {}) };
  if (auth) {
    if (auth.type === 'bearer') h['Authorization'] = `Bearer ${auth.value}`;
    else if (auth.type === 'basic') h['Authorization'] = `Basic ${Buffer.from(auth.value).toString('base64')}`;
    else if (auth.type === 'apikey') h['X-API-Key'] = auth.value;
  }
  return h;
}

const authSchema = z.object({
  type: z.enum(['bearer', 'basic', 'apikey']),
  value: z.string(),
}).optional();

registerTool({
  name: 'net.fetch',
  description: 'Perform an HTTP GET request to a URL',
  category: 'net',
  schema: z.object({
    url: z.string(),
    headers: z.record(z.string()).optional(),
    auth: authSchema,
    timeout: z.number().optional(),
    follow_redirects: z.boolean().optional(),
    response_type: z.enum(['text', 'json', 'binary']).optional(),
  }),
  handler: async (input) => {
    const { url, headers, auth, timeout = 30000, follow_redirects = true, response_type = 'json' } = input as {
      url: string; headers?: Record<string, string>; auth?: { type: string; value: string };
      timeout?: number; follow_redirects?: boolean; response_type?: string;
    };

    if (!isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}. Add it to ALLOWED_DOMAINS.`);
    }

    const cfg: AxiosRequestConfig = {
      url,
      method: 'GET',
      headers: buildHeaders(headers, auth),
      timeout,
      maxRedirects: follow_redirects ? 5 : 0,
      responseType: response_type === 'binary' ? 'arraybuffer' : 'text',
      validateStatus: () => true,
    };

    const response = await axios(cfg);
    let body: unknown = response.data;
    if (response_type === 'json' && typeof response.data === 'string') {
      try { body = JSON.parse(response.data); } catch { /* keep as text */ }
    }

    logger.info('net.fetch', { url, status: response.status });
    return {
      status: response.status,
      status_text: response.statusText,
      headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
      body,
      url: response.config.url,
    };
  },
});

registerTool({
  name: 'net.post',
  description: 'Perform an HTTP POST request to a URL',
  category: 'net',
  schema: z.object({
    url: z.string(),
    body: z.unknown().optional(),
    content_type: z.string().optional(),
    headers: z.record(z.string()).optional(),
    auth: authSchema,
    timeout: z.number().optional(),
  }),
  handler: async (input) => {
    const { url, body, content_type = 'application/json', headers, auth, timeout = 30000 } = input as {
      url: string; body?: unknown; content_type?: string;
      headers?: Record<string, string>; auth?: { type: string; value: string }; timeout?: number;
    };

    if (!isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}.`);
    }

    const mergedHeaders = buildHeaders(headers, auth);
    mergedHeaders['Content-Type'] = content_type;

    const response = await axios({
      url,
      method: 'POST',
      data: body,
      headers: mergedHeaders,
      timeout,
      validateStatus: () => true,
    });

    let resBody: unknown = response.data;
    if (typeof response.data === 'string') {
      try { resBody = JSON.parse(response.data); } catch { /* keep as text */ }
    }

    logger.info('net.post', { url, status: response.status });
    return { status: response.status, status_text: response.statusText, body: resBody };
  },
});

registerTool({
  name: 'net.request',
  description: 'Perform a generic HTTP request (any method)',
  category: 'net',
  schema: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    body: z.unknown().optional(),
    headers: z.record(z.string()).optional(),
    auth: authSchema,
    params: z.record(z.string()).optional(),
    timeout: z.number().optional(),
  }),
  handler: async (input) => {
    const { url, method, body, headers, auth, params, timeout = 30000 } = input as {
      url: string; method: string; body?: unknown; headers?: Record<string, string>;
      auth?: { type: string; value: string }; params?: Record<string, string>; timeout?: number;
    };

    if (!isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}.`);
    }

    const response = await axios({
      url,
      method,
      data: body,
      params,
      headers: buildHeaders(headers, auth),
      timeout,
      validateStatus: () => true,
    });

    let resBody: unknown = response.data;
    if (typeof response.data === 'string') {
      try { resBody = JSON.parse(response.data); } catch { /* keep as text */ }
    }

    return {
      status: response.status,
      status_text: response.statusText,
      headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
      body: resBody,
    };
  },
});

registerTool({
  name: 'net.ping_url',
  description: 'Check if a URL is reachable and measure response time',
  category: 'net',
  schema: z.object({
    url: z.string(),
    timeout: z.number().optional(),
  }),
  handler: async (input) => {
    const { url, timeout = 10000 } = input as { url: string; timeout?: number };

    if (!isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}.`);
    }

    const start = Date.now();
    try {
      const response = await axios({
        url,
        method: 'HEAD',
        timeout,
        validateStatus: () => true,
      });
      const latency = Date.now() - start;
      return { url, reachable: true, status: response.status, latency_ms: latency };
    } catch (err) {
      return { url, reachable: false, error: (err as Error).message, latency_ms: Date.now() - start };
    }
  },
});

registerTool({
  name: 'net.get_headers',
  description: 'Retrieve only the response headers from a URL (HEAD request)',
  category: 'net',
  schema: z.object({ url: z.string() }),
  handler: async (input) => {
    const { url } = input as { url: string };

    if (!isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}.`);
    }

    const response = await axios({ url, method: 'HEAD', validateStatus: () => true });
    return {
      url,
      status: response.status,
      headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
    };
  },
});
