import { z } from 'zod';
import { createHash } from 'crypto';
import { registerTool } from '../../registry';

// ─── JSON Tools ──────────────────────────────────────────────────────────────

registerTool({
  name: 'data.json_format',
  description: 'Parse and format a JSON string with optional indentation',
  category: 'data',
  schema: z.object({
    json: z.string(),
    indent: z.number().optional(),
    validate_only: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { json, indent = 2, validate_only = false } = input as {
      json: string; indent?: number; validate_only?: boolean;
    };
    try {
      const parsed = JSON.parse(json);
      if (validate_only) return { valid: true, type: typeof parsed };
      return { valid: true, formatted: JSON.stringify(parsed, null, indent), type: typeof parsed };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  },
});

registerTool({
  name: 'data.json_get',
  description: 'Extract a nested value from a JSON object using a dot-notation path',
  category: 'data',
  schema: z.object({
    json: z.unknown(),
    path: z.string(),
    default_value: z.unknown().optional(),
  }),
  handler: async (input) => {
    const { json, path: keyPath, default_value } = input as {
      json: unknown; path: string; default_value?: unknown;
    };

    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    const parts = keyPath.split('.').flatMap(p => {
      const matches = p.match(/^(.+?)\[(\d+)\]$/);
      if (matches) return [matches[1], parseInt(matches[2], 10)];
      return [p];
    });

    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) break;
      current = (current as Record<string | number, unknown>)[part as string];
    }

    const value = current !== undefined ? current : default_value;
    return { path: keyPath, value, found: current !== undefined };
  },
});

registerTool({
  name: 'data.json_merge',
  description: 'Deep-merge two JSON objects',
  category: 'data',
  schema: z.object({
    base: z.unknown(),
    overlay: z.unknown(),
  }),
  handler: async (input) => {
    const { base, overlay } = input as { base: unknown; overlay: unknown };

    function deepMerge(a: unknown, b: unknown): unknown {
      if (typeof a !== 'object' || a === null || Array.isArray(a)) return b ?? a;
      if (typeof b !== 'object' || b === null || Array.isArray(b)) return b ?? a;
      const result: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
        result[k] = deepMerge(result[k], v);
      }
      return result;
    }

    const baseObj = typeof base === 'string' ? JSON.parse(base) : base;
    const overlayObj = typeof overlay === 'string' ? JSON.parse(overlay) : overlay;
    return { merged: deepMerge(baseObj, overlayObj) };
  },
});

registerTool({
  name: 'data.json_diff',
  description: 'Compute a structural diff between two JSON values',
  category: 'data',
  schema: z.object({ a: z.unknown(), b: z.unknown() }),
  handler: async (input) => {
    const { a, b } = input as { a: unknown; b: unknown };

    const objA = typeof a === 'string' ? JSON.parse(a) : a;
    const objB = typeof b === 'string' ? JSON.parse(b) : b;

    function diff(x: unknown, y: unknown, path = ''): Array<{ path: string; type: string; from?: unknown; to?: unknown }> {
      if (JSON.stringify(x) === JSON.stringify(y)) return [];
      if (typeof x !== typeof y || x === null || y === null) {
        return [{ path: path || '.', type: 'changed', from: x, to: y }];
      }
      if (typeof x !== 'object' || Array.isArray(x)) {
        return [{ path: path || '.', type: 'changed', from: x, to: y }];
      }

      const changes: Array<{ path: string; type: string; from?: unknown; to?: unknown }> = [];
      const xObj = x as Record<string, unknown>;
      const yObj = y as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(xObj), ...Object.keys(yObj)]);

      for (const key of allKeys) {
        const subPath = path ? `${path}.${key}` : key;
        if (!(key in xObj)) {
          changes.push({ path: subPath, type: 'added', to: yObj[key] });
        } else if (!(key in yObj)) {
          changes.push({ path: subPath, type: 'removed', from: xObj[key] });
        } else {
          changes.push(...diff(xObj[key], yObj[key], subPath));
        }
      }
      return changes;
    }

    const changes = diff(objA, objB);
    return { identical: changes.length === 0, changes, change_count: changes.length };
  },
});

// ─── CSV Tools ───────────────────────────────────────────────────────────────

registerTool({
  name: 'data.csv_parse',
  description: 'Parse a CSV string into an array of row objects',
  category: 'data',
  schema: z.object({
    csv: z.string(),
    delimiter: z.string().optional(),
    has_header: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { csv, delimiter = ',', has_header = true } = input as {
      csv: string; delimiter?: string; has_header?: boolean;
    };

    const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { rows: [], count: 0 };

    function parseLine(line: string, sep: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === sep && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result;
    }

    if (!has_header) {
      const rows = lines.map(l => parseLine(l, delimiter));
      return { rows, count: rows.length };
    }

    const headers = parseLine(lines[0], delimiter);
    const rows = lines.slice(1).map(l => {
      const values = parseLine(l, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return row;
    });

    return { headers, rows, count: rows.length };
  },
});

registerTool({
  name: 'data.json_to_csv',
  description: 'Convert an array of JSON objects to CSV format',
  category: 'data',
  schema: z.object({
    data: z.array(z.record(z.unknown())),
    delimiter: z.string().optional(),
    include_header: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { data, delimiter = ',', include_header = true } = input as {
      data: Array<Record<string, unknown>>; delimiter?: string; include_header?: boolean;
    };

    if (data.length === 0) return { csv: '', rows: 0 };

    const headers = Object.keys(data[0]);
    function escape(val: unknown): string {
      const s = String(val ?? '');
      if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const rows = data.map(row => headers.map(h => escape(row[h])).join(delimiter));
    const lines = include_header ? [headers.join(delimiter), ...rows] : rows;
    return { csv: lines.join('\n'), rows: data.length, columns: headers.length };
  },
});

// ─── Encoding / Hashing ───────────────────────────────────────────────────────

registerTool({
  name: 'data.base64_encode',
  description: 'Encode a string to Base64',
  category: 'data',
  schema: z.object({ text: z.string(), url_safe: z.boolean().optional() }),
  handler: async (input) => {
    const { text, url_safe = false } = input as { text: string; url_safe?: boolean };
    let encoded = Buffer.from(text, 'utf-8').toString('base64');
    if (url_safe) encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { encoded, url_safe };
  },
});

registerTool({
  name: 'data.base64_decode',
  description: 'Decode a Base64 string to plain text',
  category: 'data',
  schema: z.object({ encoded: z.string() }),
  handler: async (input) => {
    const { encoded } = input as { encoded: string };
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf-8');
    return { decoded };
  },
});

registerTool({
  name: 'data.hash',
  description: 'Compute a cryptographic hash of a string',
  category: 'data',
  schema: z.object({
    text: z.string(),
    algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha384', 'sha512']).optional(),
    encoding: z.enum(['hex', 'base64']).optional(),
  }),
  handler: async (input) => {
    const { text, algorithm = 'sha256', encoding = 'hex' } = input as {
      text: string; algorithm?: string; encoding?: 'hex' | 'base64';
    };
    const hash = createHash(algorithm).update(text, 'utf-8').digest(encoding);
    return { algorithm, encoding, hash, input_length: text.length };
  },
});

// ─── Template Tools ───────────────────────────────────────────────────────────

registerTool({
  name: 'data.template_render',
  description: 'Render a simple mustache-style template using {{variable}} placeholders',
  category: 'data',
  schema: z.object({
    template: z.string(),
    variables: z.record(z.unknown()),
  }),
  handler: async (input) => {
    const { template, variables } = input as { template: string; variables: Record<string, unknown> };
    const rendered = template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_, key) => {
      const k = key.trim();
      const parts = k.split('.');
      let val: unknown = variables;
      for (const p of parts) val = (val as Record<string, unknown>)?.[p];
      return val !== undefined && val !== null ? String(val) : `{{${k}}}`;
    });
    return { rendered, template_length: template.length, variables_used: Object.keys(variables).length };
  },
});

// ─── String Utilities ─────────────────────────────────────────────────────────

registerTool({
  name: 'data.string_transform',
  description: 'Transform a string using common operations',
  category: 'data',
  schema: z.object({
    text: z.string(),
    operations: z.array(z.enum([
      'lowercase', 'uppercase', 'trim', 'snake_case', 'camel_case',
      'kebab_case', 'pascal_case', 'reverse', 'strip_html',
    ])),
  }),
  handler: async (input) => {
    const { text, operations } = input as { text: string; operations: string[] };

    let result = text;
    for (const op of operations) {
      switch (op) {
        case 'lowercase': result = result.toLowerCase(); break;
        case 'uppercase': result = result.toUpperCase(); break;
        case 'trim': result = result.trim(); break;
        case 'snake_case':
          result = result
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[\s-]+/g, '_')
            .toLowerCase();
          break;
        case 'camel_case':
          result = result
            .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
            .replace(/^./, c => c.toLowerCase());
          break;
        case 'kebab_case':
          result = result
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
          break;
        case 'pascal_case':
          result = result
            .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
            .replace(/^./, c => c.toUpperCase());
          break;
        case 'reverse': result = result.split('').reverse().join(''); break;
        case 'strip_html': result = result.replace(/<[^>]*>/g, ''); break;
      }
    }

    return { original: text, result, operations_applied: operations };
  },
});

registerTool({
  name: 'data.regex_extract',
  description: 'Extract matches from a string using a regular expression',
  category: 'data',
  schema: z.object({
    text: z.string(),
    pattern: z.string(),
    flags: z.string().optional(),
    all_matches: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { text, pattern, flags = 'g', all_matches = true } = input as {
      text: string; pattern: string; flags?: string; all_matches?: boolean;
    };
    try {
      const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[0]);
        if (!all_matches) break;
      }
      return { pattern, matches, count: matches.length };
    } catch (err) {
      throw new Error(`Invalid regex: ${(err as Error).message}`);
    }
  },
});

registerTool({
  name: 'data.uuid',
  description: 'Generate one or more UUID v4 values',
  category: 'data',
  schema: z.object({ count: z.number().optional() }),
  handler: async (input) => {
    const { count = 1 } = input as { count?: number };
    const { v4: uuidv4 } = await import('uuid');
    if (count === 1) return { uuid: uuidv4() };
    const uuids = Array.from({ length: Math.min(count, 100) }, () => uuidv4());
    return { uuids, count: uuids.length };
  },
});
