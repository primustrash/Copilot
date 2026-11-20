import { z } from 'zod';
import { logger } from './utils/logger';
import { verifyGrant } from './utils/tool-grants';

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  schema: z.ZodType<unknown>;
  handler: (input: unknown) => Promise<unknown>;
}

const toolRegistry = new Map<string, ToolDefinition>();
const categoryMap = new Map<string, string[]>();

// Presence in the registry does NOT mean verified or authorized. These names
// have been reviewed for passive, bounded behavior. Other legacy handlers stay
// discoverable to operators but are not exposed for execution until rewritten.
const VERIFIED_READ = new Set([
  'shell.run', 'shell.run_sandboxed', 'process.list', 'env.get',
  'get_metrics', 'proc.info', 'secrets.get', 'secrets.never_reveal',
  'approval.check',
]);
const SCOPED_FILE_OPERATIONS = new Set([
  'safe_file.create', 'safe_file.read', 'safe_file.replace', 'safe_file.delete',
]);
export interface InvocationApproval {
  actorSha256?: string;
  grant?: string;
}
export function toolAvailability(name: string): 'verified_read' | 'grant_required' | 'blocked' {
  if (VERIFIED_READ.has(name)) return 'verified_read';
  if (SCOPED_FILE_OPERATIONS.has(name)) return 'grant_required';
  return 'blocked';
}


export function registerTool(tool: ToolDefinition): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error('Duplicate MCP tool registration: ' + tool.name);
  }
  toolRegistry.set(tool.name, tool);

  const existing = categoryMap.get(tool.category) || [];
  if (!existing.includes(tool.name)) {
    existing.push(tool.name);
    categoryMap.set(tool.category, existing);
  }

  logger.debug('Tool registered', { name: tool.name, category: tool.category });
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function listTools(category?: string): ToolDefinition[] {
  if (category) {
    const names = categoryMap.get(category) || [];
    return names.map(n => toolRegistry.get(n)!).filter(Boolean);
  }
  return Array.from(toolRegistry.values());
}

export function listCategories(): string[] {
  return Array.from(categoryMap.keys());
}

export async function executeTool(name: string, input: unknown, approval: InvocationApproval = {}): Promise<unknown> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid input for tool ${name}: ${parsed.error.message}`);
  }

  const availability = toolAvailability(name);
  if (availability === 'blocked') {
    throw new Error('Tool is blocked pending individual security verification');
  }
  if (availability === 'grant_required') {
    verifyGrant(name, parsed.data, approval.actorSha256 || '', approval.grant || '');
  }
  return tool.handler(parsed.data);
}

export function getToolCount(): number {
  return toolRegistry.size;
}

export function getToolNames(): string[] {
  return Array.from(toolRegistry.keys());
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.toLowerCase();
  return Array.from(toolRegistry.values()).filter(
    t => toolAvailability(t.name) !== 'blocked' &&
      (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
       t.category.toLowerCase().includes(q))
  );
}

// MCP-compatible tool list format
export function getMCPToolList(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return Array.from(toolRegistry.values())
    .filter(tool => toolAvailability(tool.name) !== 'blocked')
    .map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema),
  }));
}

function zodToJsonSchema(schema: z.ZodType<unknown>): object {
  // Basic conversion - in production use zod-to-json-schema package
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value as z.ZodType<unknown>);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
  return { type: 'object' };
}

function zodFieldToJsonSchema(field: z.ZodType<unknown>): object {
  if (field instanceof z.ZodString) return { type: 'string' };
  if (field instanceof z.ZodNumber) return { type: 'number' };
  if (field instanceof z.ZodBoolean) return { type: 'boolean' };
  if (field instanceof z.ZodArray) return { type: 'array', items: zodFieldToJsonSchema(field.element) };
  if (field instanceof z.ZodOptional) return zodFieldToJsonSchema(field.unwrap());
  if (field instanceof z.ZodEnum) return { type: 'string', enum: field.options };
  if (field instanceof z.ZodObject) return zodToJsonSchema(field);
  return { type: 'string' };
}
