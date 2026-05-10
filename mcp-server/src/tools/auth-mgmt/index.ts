import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

interface ManagedApiKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt?: string;
  scopes: string[];
  active: boolean;
}

// In-memory store – in production this should be persisted to Redis/DB
const managedKeys = new Map<string, ManagedApiKey>();

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateKey(): string {
  return `mcp_${randomBytes(24).toString('base64url')}`;
}

export function isValidManagedKey(rawKey: string): boolean {
  const keyHash = hashKey(rawKey);
  for (const managed of managedKeys.values()) {
    if (managed.keyHash === keyHash && managed.active) {
      if (managed.expiresAt && new Date(managed.expiresAt) < new Date()) {
        return false;
      }
      return true;
    }
  }
  return false;
}

registerTool({
  name: 'auth.create_key',
  description: 'Create a new API key with optional expiry and scopes',
  category: 'auth-mgmt',
  schema: z.object({
    name: z.string(),
    scopes: z.array(z.string()).optional(),
    expires_in_days: z.number().optional(),
  }),
  handler: async (input) => {
    const { name, scopes = ['*'], expires_in_days } = input as {
      name: string; scopes?: string[]; expires_in_days?: number;
    };

    const raw = generateKey();
    const id = `key_${randomBytes(8).toString('hex')}`;
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400 * 1000).toISOString()
      : undefined;

    const managed: ManagedApiKey = {
      id,
      name,
      keyHash: hashKey(raw),
      keyPrefix: raw.slice(0, 12) + '...',
      createdAt: new Date().toISOString(),
      expiresAt,
      scopes,
      active: true,
    };

    managedKeys.set(id, managed);
    logger.info('auth.create_key', { id, name, scopes });

    return {
      success: true,
      key_id: id,
      api_key: raw,
      key_prefix: managed.keyPrefix,
      name,
      scopes,
      expires_at: expiresAt,
      warning: 'Store this key securely – it will not be shown again.',
    };
  },
});

registerTool({
  name: 'auth.list_keys',
  description: 'List all managed API keys (without revealing the actual keys)',
  category: 'auth-mgmt',
  schema: z.object({
    include_inactive: z.boolean().optional(),
  }),
  handler: async (input) => {
    const { include_inactive = false } = input as { include_inactive?: boolean };

    const keys = Array.from(managedKeys.values())
      .filter(k => include_inactive || k.active)
      .map(k => ({
        id: k.id,
        name: k.name,
        key_prefix: k.keyPrefix,
        scopes: k.scopes,
        active: k.active,
        created_at: k.createdAt,
        expires_at: k.expiresAt,
        expired: k.expiresAt ? new Date(k.expiresAt) < new Date() : false,
      }));

    return { keys, count: keys.length };
  },
});

registerTool({
  name: 'auth.revoke_key',
  description: 'Revoke an API key by ID',
  category: 'auth-mgmt',
  schema: z.object({ key_id: z.string() }),
  handler: async (input) => {
    const { key_id } = input as { key_id: string };
    const managed = managedKeys.get(key_id);
    if (!managed) throw new Error(`Key not found: ${key_id}`);
    managed.active = false;
    logger.warn('auth.revoke_key', { key_id, name: managed.name });
    return { success: true, key_id, name: managed.name, revoked_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'auth.rotate_key',
  description: 'Rotate an existing API key: revoke the old one and issue a new one',
  category: 'auth-mgmt',
  schema: z.object({ key_id: z.string() }),
  handler: async (input) => {
    const { key_id } = input as { key_id: string };
    const old = managedKeys.get(key_id);
    if (!old) throw new Error(`Key not found: ${key_id}`);

    old.active = false;

    const raw = generateKey();
    const newId = `key_${randomBytes(8).toString('hex')}`;
    const managed: ManagedApiKey = {
      id: newId,
      name: `${old.name} (rotated)`,
      keyHash: hashKey(raw),
      keyPrefix: raw.slice(0, 12) + '...',
      createdAt: new Date().toISOString(),
      expiresAt: old.expiresAt,
      scopes: old.scopes,
      active: true,
    };

    managedKeys.set(newId, managed);
    logger.info('auth.rotate_key', { old_id: key_id, new_id: newId });

    return {
      success: true,
      old_key_id: key_id,
      new_key_id: newId,
      api_key: raw,
      key_prefix: managed.keyPrefix,
      scopes: old.scopes,
      warning: 'Store this key securely – it will not be shown again.',
    };
  },
});

registerTool({
  name: 'auth.inspect_key',
  description: 'Get metadata for an API key by ID (does not reveal the key)',
  category: 'auth-mgmt',
  schema: z.object({ key_id: z.string() }),
  handler: async (input) => {
    const { key_id } = input as { key_id: string };
    const k = managedKeys.get(key_id);
    if (!k) throw new Error(`Key not found: ${key_id}`);
    return {
      id: k.id,
      name: k.name,
      key_prefix: k.keyPrefix,
      scopes: k.scopes,
      active: k.active,
      created_at: k.createdAt,
      expires_at: k.expiresAt,
      expired: k.expiresAt ? new Date(k.expiresAt) < new Date() : false,
    };
  },
});

registerTool({
  name: 'auth.verify_key',
  description: 'Verify that a raw API key is valid and active',
  category: 'auth-mgmt',
  schema: z.object({ api_key: z.string() }),
  handler: async (input) => {
    const { api_key } = input as { api_key: string };
    const keyHash = hashKey(api_key);
    for (const k of managedKeys.values()) {
      if (k.keyHash === keyHash) {
        const expired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false;
        return {
          valid: k.active && !expired,
          key_id: k.id,
          name: k.name,
          scopes: k.scopes,
          active: k.active,
          expired,
          expires_at: k.expiresAt,
        };
      }
    }
    // Also check the static API_KEY_SECRET for backward compatibility
    const staticValid = api_key === config.auth.apiKeySecret;
    return { valid: staticValid, key_id: 'static', name: 'static-key', scopes: ['*'], active: staticValid };
  },
});

registerTool({
  name: 'auth.config_summary',
  description: 'Get a summary of the current authentication configuration (no secrets revealed)',
  category: 'auth-mgmt',
  schema: z.object({}),
  handler: async () => {
    return {
      methods_enabled: {
        api_key_header: true,
        bearer_schemes: ['Bearer', 'Token', 'ApiKey'],
        basic_auth: config.auth.allowBasicAuth,
        jwt: config.auth.allowJwtBearer,
        oauth2: Boolean(config.auth.oauth.authUrl && config.auth.oauth.tokenUrl),
        query_token: config.auth.allowQueryTokenAuth,
        body_token: config.auth.allowBodyTokenAuth,
        cookie_token: config.auth.allowCookieTokenAuth,
      },
      oauth: {
        configured: Boolean(config.auth.oauth.clientId),
        grant_types: config.auth.oauth.grantTypes,
        scopes: config.auth.oauth.scopes,
        pkce_enabled: config.auth.oauth.pkceEnabled,
        has_introspection: Boolean(config.auth.oauth.introspectionUrl),
        has_revocation: Boolean(config.auth.oauth.revokeUrl),
      },
      managed_keys: {
        total: managedKeys.size,
        active: Array.from(managedKeys.values()).filter(k => k.active).length,
      },
      accepted_headers: config.auth.acceptedApiKeyHeaders,
      static_key_configured: Boolean(config.auth.apiKeySecret),
      jwt_configured: Boolean(config.auth.jwtSecret),
    };
  },
});
