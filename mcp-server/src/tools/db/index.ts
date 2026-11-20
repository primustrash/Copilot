import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

// ─── Redis / Cache Tools ────────────────────────────────────────────────────

function getRedisClient() {
  const Redis = require('ioredis');
  return new Redis(config.db.redisUrl, { lazyConnect: true, connectTimeout: 5000 });
}

async function withRedis<T>(fn: (redis: import('ioredis').Redis) => Promise<T>): Promise<T> {
  const redis = getRedisClient();
  try {
    await redis.connect();
    return await fn(redis);
  } finally {
    await redis.quit().catch(() => { /* ignore */ });
  }
}

registerTool({
  name: 'cache.get',
  description: 'Get a value from Redis cache by key',
  category: 'db',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    return withRedis(async (redis) => {
      const value = await redis.get(key);
      if (value === null) return { key, found: false, value: null };
      try {
        return { key, found: true, value: JSON.parse(value) };
      } catch {
        return { key, found: true, value };
      }
    });
  },
});

registerTool({
  name: 'cache.set',
  description: 'Set a value in Redis cache',
  category: 'db',
  schema: z.object({
    key: z.string(),
    value: z.unknown(),
    ttl_seconds: z.number().optional(),
  }),
  handler: async (input) => {
    const { key, value, ttl_seconds } = input as { key: string; value: unknown; ttl_seconds?: number };
    return withRedis(async (redis) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl_seconds) {
        await redis.setex(key, ttl_seconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
      logger.info('cache.set', { key, ttl_seconds });
      return { success: true, key, ttl_seconds };
    });
  },
});

registerTool({
  name: 'cache.del',
  description: 'Delete one or more keys from Redis cache',
  category: 'db',
  schema: z.object({ keys: z.array(z.string()) }),
  handler: async (input) => {
    const { keys } = input as { keys: string[] };
    return withRedis(async (redis) => {
      const count = await redis.del(...keys);
      return { deleted: count, keys };
    });
  },
});

registerTool({
  name: 'cache.keys',
  description: 'List Redis keys matching a pattern',
  category: 'db',
  schema: z.object({ pattern: z.string().optional() }),
  handler: async (input) => {
    const { pattern = '*' } = input as { pattern?: string };
    return withRedis(async (redis) => {
      const keys = await redis.keys(pattern);
      return { pattern, keys, count: keys.length };
    });
  },
});

registerTool({
  name: 'cache.expire',
  description: 'Set TTL (time-to-live) on a Redis key',
  category: 'db',
  schema: z.object({ key: z.string(), ttl_seconds: z.number() }),
  handler: async (input) => {
    const { key, ttl_seconds } = input as { key: string; ttl_seconds: number };
    return withRedis(async (redis) => {
      const result = await redis.expire(key, ttl_seconds);
      return { key, ttl_seconds, applied: result === 1 };
    });
  },
});

registerTool({
  name: 'cache.ttl',
  description: 'Get the remaining TTL of a Redis key',
  category: 'db',
  schema: z.object({ key: z.string() }),
  handler: async (input) => {
    const { key } = input as { key: string };
    return withRedis(async (redis) => {
      const ttl = await redis.ttl(key);
      return { key, ttl_seconds: ttl, expires: ttl >= 0 };
    });
  },
});

registerTool({
  name: 'cache.info',
  description: 'Get Redis server info and stats',
  category: 'db',
  schema: z.object({}),
  handler: async () => {
    return withRedis(async (redis) => {
      const info = await redis.info();
      const dbSize = await redis.dbsize();
      const lines = info.split('\n').filter(l => l && !l.startsWith('#'));
      const parsed: Record<string, string> = {};
      for (const line of lines) {
        const [k, v] = line.split(':');
        if (k && v !== undefined) parsed[k.trim()] = v.trim();
      }
      return {
        db_size: dbSize,
        version: parsed['redis_version'],
        used_memory_human: parsed['used_memory_human'],
        connected_clients: parseInt(parsed['connected_clients'] || '0', 10),
        uptime_in_seconds: parseInt(parsed['uptime_in_seconds'] || '0', 10),
      };
    });
  },
});

registerTool({
  name: 'cache.incr',
  description: 'Atomically increment a Redis counter',
  category: 'db',
  schema: z.object({ key: z.string(), by: z.number().optional() }),
  handler: async (input) => {
    const { key, by = 1 } = input as { key: string; by?: number };
    return withRedis(async (redis) => {
      const value = by === 1 ? await redis.incr(key) : await redis.incrby(key, by);
      return { key, value };
    });
  },
});

registerTool({
  name: 'cache.mget',
  description: 'Get multiple Redis keys at once',
  category: 'db',
  schema: z.object({ keys: z.array(z.string()) }),
  handler: async (input) => {
    const { keys } = input as { keys: string[] };
    return withRedis(async (redis) => {
      const values = await redis.mget(...keys);
      const result: Record<string, unknown> = {};
      keys.forEach((key, i) => {
        const raw = values[i];
        if (raw === null) {
          result[key] = null;
        } else {
          try { result[key] = JSON.parse(raw); } catch { result[key] = raw; }
        }
      });
      return { keys, values: result };
    });
  },
});

// ─── PostgreSQL Tools ────────────────────────────────────────────────────────

async function withPg<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: config.db.postgresUrl, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* ... */
    .replace(/--[^\n]*/g, ' ')          // -- line comments
    .replace(/\s+/g, ' ')
    .trim();
}

registerTool({
  name: 'db.query',
  description: 'Execute a read-only SQL SELECT query on PostgreSQL',
  category: 'db',
  schema: z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { sql, params = [] } = input as { sql: string; params?: unknown[] };

    const normalized = stripSqlComments(sql).toLowerCase();
    if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
      throw new Error('db.query only allows SELECT/WITH queries. Use db.execute for mutations.');
    }

    return withPg(async (client) => {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        row_count: result.rowCount ?? result.rows.length,
        fields: result.fields.map(f => ({ name: f.name, data_type_id: f.dataTypeID })),
      };
    });
  },
});

registerTool({
  name: 'db.execute',
  description: 'Execute a SQL statement (INSERT/UPDATE/DELETE) on PostgreSQL',
  category: 'db',
  schema: z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
  }),
  handler: async (input) => {
    const { sql, params = [] } = input as { sql: string; params?: unknown[] };

    const normalized = stripSqlComments(sql).toLowerCase();
    const BLOCKED_DDL = ['drop ', 'truncate ', 'create ', 'alter ', 'grant ', 'revoke '];
    if (BLOCKED_DDL.some(kw => normalized.includes(kw))) {
      throw new Error('DDL statements (DROP/TRUNCATE/CREATE/ALTER/GRANT/REVOKE) are not allowed via db.execute.');
    }

    return withPg(async (client) => {
      const result = await client.query(sql, params);
      logger.info('db.execute', { rows_affected: result.rowCount });
      return {
        rows_affected: result.rowCount ?? 0,
        command: result.command,
        rows: result.rows,
      };
    });
  },
});

registerTool({
  name: 'db.table_list',
  description: 'List all tables in the PostgreSQL database',
  category: 'db',
  schema: z.object({ schema: z.string().optional() }),
  handler: async (input) => {
    const { schema = 'public' } = input as { schema?: string };
    return withPg(async (client) => {
      const result = await client.query(
        `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
        [schema]
      );
      return { schema, tables: result.rows, count: result.rows.length };
    });
  },
});

registerTool({
  name: 'db.describe_table',
  description: 'Describe the columns of a PostgreSQL table',
  category: 'db',
  schema: z.object({ table: z.string(), schema: z.string().optional() }),
  handler: async (input) => {
    const { table, schema = 'public' } = input as { table: string; schema?: string };
    return withPg(async (client) => {
      const result = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table]
      );
      return { schema, table, columns: result.rows };
    });
  },
});

registerTool({
  name: 'db.stats',
  description: 'Get PostgreSQL database statistics',
  category: 'db',
  schema: z.object({}),
  handler: async () => {
    return withPg(async (client) => {
      const result = await client.query(
        `SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size,
                numbackends, xact_commit, xact_rollback
         FROM pg_stat_database
         WHERE datname = current_database()`
      );
      return { stats: result.rows[0] || {} };
    });
  },
});
