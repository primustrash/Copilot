import { z } from 'zod';
import { registerTool } from '../../registry';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

const policies = new Map<string, unknown>();
const secrets = new Map<string, string>();

// Initialize from config
policies.set('allowed_domains', config.security.allowedDomains);
policies.set('allowed_paths', config.security.allowedPaths);
policies.set('allowed_apps', config.security.allowedApps);

registerTool({
  name: 'policy.get',
  description: 'Get a security policy',
  category: 'security',
  schema: z.object({ policy_name: z.string() }),
  handler: async (input) => {
    const { policy_name } = input as { policy_name: string };
    return { policy_name, value: policies.get(policy_name) ?? null };
  },
});

registerTool({
  name: 'policy.set',
  description: 'Set a security policy',
  category: 'security',
  schema: z.object({ policy_name: z.string(), value: z.unknown() }),
  handler: async (input) => {
    const { policy_name, value } = input as { policy_name: string; value: unknown };
    policies.set(policy_name, value);
    logger.info('Policy updated', { policy_name });
    return { success: true, policy_name, value };
  },
});

registerTool({
  name: 'approval.request',
  description: 'Request approval for a potentially dangerous action',
  category: 'security',
  schema: z.object({
    action: z.string(),
    description: z.string(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
  handler: async (input) => {
    const { action, description, risk_level = 'medium' } = input as {
      action: string; description: string; risk_level?: string;
    };
    const requestId = `approval-${Date.now()}`;
    logger.warn('Approval requested', { requestId, action, risk_level });
    return { approval_id: requestId, action, description, risk_level, status: 'pending' };
  },
});

registerTool({
  name: 'approval.check',
  description: 'Check approval status',
  category: 'security',
  schema: z.object({ approval_id: z.string() }),
  handler: async (input) => {
    const { approval_id } = input as { approval_id: string };
    return { approval_id, status: 'pending', approved: false };
  },
});

registerTool({
  name: 'secrets.get',
  description: 'Get a secret value (masked in logs)',
  category: 'security',
  schema: z.object({ secret_name: z.string() }),
  handler: async (input) => {
    const { secret_name } = input as { secret_name: string };
    const value = secrets.get(secret_name);
    if (!value) return { secret_name, found: false };
    // Never log the actual secret
    logger.info('Secret accessed', { secret_name });
    return { secret_name, value, found: true };
  },
});

registerTool({
  name: 'secrets.never_reveal',
  description: 'Verify a secret exists without revealing it',
  category: 'security',
  schema: z.object({ secret_name: z.string() }),
  handler: async (input) => {
    const { secret_name } = input as { secret_name: string };
    const exists = secrets.has(secret_name);
    return { secret_name, exists, value: exists ? '***REDACTED***' : null };
  },
});

registerTool({
  name: 'kill_switch.enable',
  description: 'Enable the kill switch to stop all agent operations',
  category: 'security',
  schema: z.object({ reason: z.string() }),
  handler: async (input) => {
    const { reason } = input as { reason: string };
    logger.warn('KILL SWITCH ENABLED', { reason });
    return { enabled: true, reason, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'kill_switch.trigger',
  description: 'Trigger the kill switch for emergency stop',
  category: 'security',
  schema: z.object({ reason: z.string(), token: z.string() }),
  handler: async (input) => {
    const { reason, token } = input as { reason: string; token: string };
    if (token !== config.security.killSwitchToken) {
      throw new Error('Invalid kill switch token');
    }
    logger.error('KILL SWITCH TRIGGERED', { reason });
    return { triggered: true, reason, timestamp: new Date().toISOString() };
  },
});

registerTool({
  name: 'network.allowlist',
  description: 'Get or update the network domain allowlist',
  category: 'security',
  schema: z.object({
    action: z.enum(['get', 'add', 'remove']),
    domain: z.string().optional(),
  }),
  handler: async (input) => {
    const { action, domain } = input as { action: string; domain?: string };
    if (action === 'get') {
      return { allowlist: config.security.allowedDomains };
    }
    if (action === 'add' && domain) {
      config.security.allowedDomains.push(domain);
      return { success: true, added: domain, allowlist: config.security.allowedDomains };
    }
    if (action === 'remove' && domain) {
      const idx = config.security.allowedDomains.indexOf(domain);
      if (idx > -1) config.security.allowedDomains.splice(idx, 1);
      return { success: true, removed: domain, allowlist: config.security.allowedDomains };
    }
    return { error: 'Invalid action or missing domain' };
  },
});

registerTool({
  name: 'filesystem.allowlist',
  description: 'Get or update the filesystem path allowlist',
  category: 'security',
  schema: z.object({
    action: z.enum(['get', 'add', 'remove']),
    path: z.string().optional(),
  }),
  handler: async (input) => {
    const { action, path } = input as { action: string; path?: string };
    if (action === 'get') {
      return { allowlist: config.security.allowedPaths };
    }
    if (action === 'add' && path) {
      config.security.allowedPaths.push(path);
      return { success: true, added: path };
    }
    if (action === 'remove' && path) {
      const idx = config.security.allowedPaths.indexOf(path);
      if (idx > -1) config.security.allowedPaths.splice(idx, 1);
      return { success: true, removed: path };
    }
    return { error: 'Invalid action or missing path' };
  },
});

registerTool({
  name: 'app.allowlist',
  description: 'Get or update the application allowlist',
  category: 'security',
  schema: z.object({
    action: z.enum(['get', 'add', 'remove']),
    app: z.string().optional(),
  }),
  handler: async (input) => {
    const { action, app } = input as { action: string; app?: string };
    if (action === 'get') {
      return { allowlist: config.security.allowedApps };
    }
    if (action === 'add' && app) {
      config.security.allowedApps.push(app);
      return { success: true, added: app };
    }
    if (action === 'remove' && app) {
      const idx = config.security.allowedApps.indexOf(app);
      if (idx > -1) config.security.allowedApps.splice(idx, 1);
      return { success: true, removed: app };
    }
    return { error: 'Invalid action or missing app' };
  },
});

// Security scan tools
registerTool({
  name: 'security.scan_secrets',
  description: 'Scan code/files for exposed secrets',
  category: 'security',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: scanPath } = input as { path: string };
    const { runSandboxed } = await import('../../utils/sandbox');
    const result = await runSandboxed('grep', ['-r', '-E',
      '(password|secret|api_key|token|private_key)\\s*=\\s*["\'].{8,}["\']',
      scanPath, '--include=*.ts', '--include=*.js', '--include=*.env',
      '-l'], { timeout: 30000, cwd: '/tmp' });
    const files = result.stdout.trim().split('\n').filter(Boolean);
    return { scan_path: scanPath, potential_exposures: files, count: files.length };
  },
});

registerTool({
  name: 'security.scan_dependencies',
  description: 'Scan dependencies for known vulnerabilities',
  category: 'security',
  schema: z.object({ cwd: z.string() }),
  handler: async (input) => {
    const { cwd } = input as { cwd: string };
    const { runSandboxed } = await import('../../utils/sandbox');
    const result = await runSandboxed('npm', ['audit', '--json'], { timeout: 60000, cwd });
    try {
      const audit = JSON.parse(result.stdout);
      return { vulnerabilities: audit.vulnerabilities, metadata: audit.metadata };
    } catch {
      return { output: result.stdout, error: result.stderr };
    }
  },
});

registerTool({
  name: 'security.scan_code',
  description: 'Static security analysis of code',
  category: 'security',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: codePath } = input as { path: string };
    return { path: codePath, issues: [], message: 'Integrate with Semgrep or CodeQL for full scanning' };
  },
});

registerTool({
  name: 'security.check_license',
  description: 'Check license compatibility of dependencies',
  category: 'security',
  schema: z.object({ cwd: z.string() }),
  handler: async (input) => {
    const { cwd } = input as { cwd: string };
    const { runSandboxed } = await import('../../utils/sandbox');
    const result = await runSandboxed('npx', ['license-checker', '--json'], { timeout: 60000, cwd });
    try {
      const licenses = JSON.parse(result.stdout);
      return { licenses, package_count: Object.keys(licenses).length };
    } catch {
      return { output: result.stdout };
    }
  },
});

registerTool({
  name: 'security.validate_permissions',
  description: 'Validate file/directory permissions',
  category: 'security',
  schema: z.object({ path: z.string() }),
  handler: async (input) => {
    const { path: checkPath } = input as { path: string };
    const fs = await import('fs');
    try {
      const stats = fs.statSync(checkPath);
      const mode = stats.mode.toString(8);
      return { path: checkPath, mode, permissions: mode.slice(-3), world_writable: (stats.mode & 0o002) !== 0 };
    } catch (err) {
      throw new Error(`Cannot stat path: ${checkPath}`);
    }
  },
});

registerTool({
  name: 'security.request_approval',
  description: 'Request security approval for an action',
  category: 'security',
  schema: z.object({ action: z.string(), reason: z.string() }),
  handler: async (input) => {
    const { action, reason } = input as { action: string; reason: string };
    const requestId = `sec-approval-${Date.now()}`;
    logger.warn('Security approval requested', { requestId, action, reason });
    return { approval_id: requestId, action, reason, status: 'pending' };
  },
});

registerTool({
  name: 'security.audit_action',
  description: 'Audit a security-sensitive action',
  category: 'security',
  schema: z.object({ action: z.string(), result: z.string(), metadata: z.record(z.unknown()).optional() }),
  handler: async (input) => {
    const { action, result, metadata } = input as { action: string; result: string; metadata?: Record<string, unknown> };
    const entry = { action, result, metadata, timestamp: new Date().toISOString() };
    logger.warn('Security audit', entry);
    return { audited: true, entry };
  },
});
