import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  server: {
    port: parseInt(process.env.MCP_PORT || '3000', 10),
    host: process.env.MCP_HOST || '0.0.0.0',
    baseUrl: process.env.MCP_BASE_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  db: {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    postgresUrl: process.env.POSTGRES_URL || 'postgresql://mcpuser:mcppassword@localhost:5432/mcpdb',
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  },
  auth: {
    apiKeySecret: process.env.API_KEY_SECRET || '',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
    acceptedApiKeyHeaders: splitCsv(process.env.AUTH_API_KEY_HEADERS || 'x-api-key,api-key,x-auth-token'),
    allowBearerApiKey: process.env.AUTH_ALLOW_BEARER_API_KEY !== 'false',
    allowBasicAuth: process.env.AUTH_ALLOW_BASIC !== 'false',
    allowJwtBearer: process.env.AUTH_ALLOW_JWT !== 'false',
    allowQueryTokenAuth: process.env.AUTH_ALLOW_QUERY_TOKEN === 'true',
    allowBodyTokenAuth: process.env.AUTH_ALLOW_BODY_TOKEN === 'true',
    allowCookieTokenAuth: process.env.AUTH_ALLOW_COOKIE_TOKEN !== 'false',
    acceptedQueryTokenParams: splitCsv(process.env.AUTH_QUERY_TOKEN_PARAMS || 'api_key,apikey,access_token,token'),
    acceptedBodyTokenFields: splitCsv(process.env.AUTH_BODY_TOKEN_FIELDS || 'api_key,apikey,access_token,token'),
    acceptedCookieNames: splitCsv(process.env.AUTH_COOKIE_TOKEN_NAMES || 'mcp_token,access_token,api_key'),
    oauth: {
      clientId: process.env.OAUTH_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      authUrl: process.env.OAUTH_AUTH_URL || '',
      tokenUrl: process.env.OAUTH_TOKEN_URL || '',
      userInfoUrl: process.env.OAUTH_USERINFO_URL || '',
      introspectionUrl: process.env.OAUTH_INTROSPECTION_URL || '',
      revokeUrl: process.env.OAUTH_REVOKE_URL || '',
      scopes: splitCsv(process.env.OAUTH_SCOPES || 'openid,email,profile'),
      grantTypes: splitCsv(process.env.OAUTH_GRANT_TYPES || 'authorization_code,refresh_token,client_credentials'),
      tokenAuthMethod: process.env.OAUTH_TOKEN_AUTH_METHOD || 'client_secret_post',
      pkceEnabled: process.env.OAUTH_PKCE_ENABLED !== 'false',
    },
    remoteProfiles: {
      primusnex: {
        mcpUrl: process.env.PRIMUSNEX_MCP_URL || 'https://mcp.primusnex.com/mcp',
        apiKeyHeader: process.env.PRIMUSNEX_API_KEY_HEADER || 'x-api-key',
        oauthAuthUrl: process.env.PRIMUSNEX_OAUTH_AUTH_URL || 'https://mcp.primusnex.com/oauth/authorize',
        oauthTokenUrl: process.env.PRIMUSNEX_OAUTH_TOKEN_URL || 'https://mcp.primusnex.com/oauth/token',
        clientId: process.env.PRIMUSNEX_OAUTH_CLIENT_ID || '',
        clientSecret: process.env.PRIMUSNEX_OAUTH_CLIENT_SECRET || '',
      },
    },
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
    appId: process.env.GITHUB_APP_ID || '',
    privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
  },
  gitlab: {
    token: process.env.GITLAB_TOKEN || '',
    baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com/api/v4',
  },
  ssh: {
    keyPath: process.env.SSH_KEY_PATH || path.join(process.env.HOME || '/root', '.ssh', 'id_rsa'),
    knownHostsPath: process.env.SSH_KNOWN_HOSTS_PATH || path.join(process.env.HOME || '/root', '.ssh', 'known_hosts'),
  },
  security: {
    allowedDomains: (process.env.ALLOWED_DOMAINS || 'localhost,127.0.0.1').split(',').map(d => d.trim()),
    allowedPaths: (process.env.ALLOWED_PATHS || '/home,/tmp,/var/mcp').split(',').map(p => p.trim()),
    allowedApps: (process.env.ALLOWED_APPS || 'bash,python3,node,git').split(',').map(a => a.trim()),
    killSwitchEnabled: process.env.KILL_SWITCH_ENABLED === 'true',
    killSwitchToken: process.env.KILL_SWITCH_TOKEN || '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },
  budget: {
    maxTokensPerHour: parseInt(process.env.BUDGET_MAX_TOKENS_PER_HOUR || '100000', 10),
    maxCostUsdPerDay: parseFloat(process.env.BUDGET_MAX_COST_USD_PER_DAY || '10.00'),
  },
  playwright: {
    serverUrl: process.env.PLAYWRIGHT_SERVER_URL || 'ws://localhost:3001',
    browser: process.env.PLAYWRIGHT_BROWSER || 'chromium',
  },
  audio: {
    whisperModel: process.env.WHISPER_MODEL || 'base',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000', 10),
  },
  workspace: {
    root: process.env.WORKSPACE_ROOT || '/var/mcp/workspaces',
    sandboxRoot: process.env.SANDBOX_ROOT || '/var/mcp/sandboxes',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || '/var/log/mcp-server/app.log',
    auditFile: process.env.AUDIT_LOG_FILE || '/var/log/mcp-server/audit.log',
  },
};
