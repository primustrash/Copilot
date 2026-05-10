import { z } from 'zod';
import { logger } from './utils/logger';

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  schema: z.ZodType<unknown>;
  handler: (input: unknown) => Promise<unknown>;
}

const toolRegistry = new Map<string, ToolDefinition>();
const categoryMap = new Map<string, string[]>();

export function registerTool(tool: ToolDefinition): void {
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

export async function executeTool(name: string, input: unknown): Promise<unknown> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid input for tool ${name}: ${parsed.error.message}`);
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
    t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
  );
}

// MCP-compatible tool list format
export function getMCPToolList(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return Array.from(toolRegistry.values()).map(tool => ({
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
