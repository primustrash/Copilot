import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface OAuthUserInfo {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
}

interface OAuthIntrospectionResponse {
  active?: boolean;
  scope?: string;
  client_id?: string;
  sub?: string;
  exp?: number;
}

interface OAuthAuthorizationOptions {
  state?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
  prompt?: string;
  accessType?: string;
  loginHint?: string;
}

function buildTokenRequestHeaders(): Record<string, string> {
  if (config.auth.oauth.tokenAuthMethod === 'client_secret_basic' && config.auth.oauth.clientId && config.auth.oauth.clientSecret) {
    const basic = Buffer.from(`${config.auth.oauth.clientId}:${config.auth.oauth.clientSecret}`).toString('base64');
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    };
  }

  return { 'Content-Type': 'application/x-www-form-urlencoded' };
}

function decodeJwtPayload(token: string): OAuthUserInfo {
  try {
    const [, payload] = token.split('.');
    if (!payload) return {};
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as OAuthUserInfo;
    return json;
  } catch {
    return {};
  }
}

export function getOAuthAuthorizationUrl(state?: string): string {
  return getOAuthAuthorizationUrlWithOptions({ state });
}

function getOAuthAuthorizationUrlWithOptions(options: OAuthAuthorizationOptions = {}): string {
  const scopes = options.scopes && options.scopes.length > 0 ? options.scopes : config.auth.oauth.scopes;
  const params = new URLSearchParams({
    client_id: config.auth.oauth.clientId,
    redirect_uri: config.auth.oauth.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    ...(options.state ? { state: options.state } : {}),
    ...(options.codeChallenge ? { code_challenge: options.codeChallenge } : {}),
    ...(options.codeChallenge ? { code_challenge_method: options.codeChallengeMethod || 'S256' } : {}),
    ...(options.prompt ? { prompt: options.prompt } : {}),
    ...(options.accessType ? { access_type: options.accessType } : {}),
    ...(options.loginHint ? { login_hint: options.loginHint } : {}),
  });
  return `${config.auth.oauth.authUrl}?${params.toString()}`;
}

async function requestOAuthToken(params: URLSearchParams): Promise<OAuthTokenResponse> {
  const response = await axios.post<OAuthTokenResponse>(
    config.auth.oauth.tokenUrl,
    params,
    { headers: buildTokenRequestHeaders() }
  );
  return response.data;
}

function appendClientCredentials(params: URLSearchParams): void {
  if (config.auth.oauth.tokenAuthMethod !== 'client_secret_basic') {
    params.set('client_id', config.auth.oauth.clientId);
    params.set('client_secret', config.auth.oauth.clientSecret);
  }
}

export async function exchangeCodeForToken(code: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    code,
    redirect_uri: config.auth.oauth.redirectUri,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) {
    params.set('code_verifier', codeVerifier);
  }
  appendClientCredentials(params);
  return requestOAuthToken(params);
}

export async function getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  if (!config.auth.oauth.userInfoUrl) {
    return decodeJwtPayload(accessToken);
  }

  const response = await axios.get<OAuthUserInfo>(config.auth.oauth.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export function generateJWT(payload: object): string {
  if (!config.auth.jwtSecret) {
    throw new Error('JWT secret is not configured');
  }
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiry } as jwt.SignOptions);
}

export function verifyJWT(token: string): jwt.JwtPayload | string {
  if (!config.auth.jwtSecret) {
    throw new Error('JWT secret is not configured');
  }
  return jwt.verify(token, config.auth.jwtSecret);
}

export async function introspectOAuthToken(token: string): Promise<OAuthIntrospectionResponse | null> {
  if (!config.auth.oauth.introspectionUrl) {
    return null;
  }

  const params = new URLSearchParams({ token });
  if (config.auth.oauth.tokenAuthMethod !== 'client_secret_basic') {
    params.set('client_id', config.auth.oauth.clientId);
    params.set('client_secret', config.auth.oauth.clientSecret);
  }

  try {
    const response = await axios.post<OAuthIntrospectionResponse>(
      config.auth.oauth.introspectionUrl,
      params,
      { headers: buildTokenRequestHeaders() }
    );
    return response.data;
  } catch (err) {
    logger.warn('OAuth introspection failed', { err });
    return null;
  }
}

export async function handleOAuthRedirect(req: Request, res: Response): Promise<void> {
  const { code, state, error, code_verifier } = req.query as Record<string, string>;

  if (error) {
    logger.error('OAuth error', { error });
    res.status(400).json({ error: `OAuth error: ${error}` });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code, code_verifier);
    const userInfo = await getUserInfo(tokenResponse.access_token);
    const mcpToken = generateJWT({ user: userInfo, state });

    res.json({
      mcp_token: mcpToken,
      user: userInfo,
      expires_in: config.auth.jwtExpiry,
    });
  } catch (err) {
    logger.error('OAuth token exchange failed', { err });
    res.status(500).json({ error: 'OAuth token exchange failed' });
  }
}

function parseScopes(scopeValue: string | undefined): string[] {
  if (!scopeValue) return config.auth.oauth.scopes;
  return scopeValue
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function handleOAuthInitiate(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string | undefined>;
  const state = query.state || randomBytes(16).toString('hex');
  const scopes = parseScopes(query.scope || query.scopes);
  const codeChallenge = query.code_challenge;
  const codeChallengeMethod = query.code_challenge_method;
  const authUrl = getOAuthAuthorizationUrlWithOptions({
    state,
    scopes,
    codeChallenge,
    codeChallengeMethod,
    prompt: query.prompt,
    accessType: query.access_type,
    loginHint: query.login_hint,
  });
  res.json({
    auth_url: authUrl,
    state,
    scopes,
    grant_types: config.auth.oauth.grantTypes,
    pkce_enabled: config.auth.oauth.pkceEnabled,
    code_challenge_required: Boolean(codeChallenge),
  });
}

export async function handleOAuthTokenExchange(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, string | undefined>;
  const grantType = body.grant_type || 'authorization_code';

  if (!config.auth.oauth.tokenUrl) {
    res.status(400).json({ error: 'OAuth token endpoint is not configured' });
    return;
  }

  try {
    const params = new URLSearchParams({ grant_type: grantType });

    if (grantType === 'authorization_code') {
      if (!body.code) {
        res.status(400).json({ error: 'Missing code for authorization_code flow' });
        return;
      }
      params.set('code', body.code);
      params.set('redirect_uri', body.redirect_uri || config.auth.oauth.redirectUri);
      if (body.code_verifier) params.set('code_verifier', body.code_verifier);
    } else if (grantType === 'refresh_token') {
      if (!body.refresh_token) {
        res.status(400).json({ error: 'Missing refresh_token for refresh_token flow' });
        return;
      }
      params.set('refresh_token', body.refresh_token);
      if (body.scope) params.set('scope', body.scope);
    } else if (grantType === 'client_credentials') {
      if (body.scope) params.set('scope', body.scope);
      if (body.audience) params.set('audience', body.audience);
      if (body.resource) params.set('resource', body.resource);
    } else {
      res.status(400).json({ error: `Unsupported grant_type: ${grantType}` });
      return;
    }

    appendClientCredentials(params);
    const tokenResponse = await requestOAuthToken(params);
    res.json(tokenResponse);
  } catch (err) {
    logger.error('OAuth manual token exchange failed', { err, grantType });
    res.status(500).json({ error: 'OAuth token exchange failed' });
  }
}

export async function handleOAuthMetadata(_req: Request, res: Response): Promise<void> {
  res.json({
    issuer: config.server.baseUrl,
    authorization_endpoint: config.auth.oauth.authUrl,
    token_endpoint: config.auth.oauth.tokenUrl,
    userinfo_endpoint: config.auth.oauth.userInfoUrl || undefined,
    revocation_endpoint: config.auth.oauth.revokeUrl || undefined,
    introspection_endpoint: config.auth.oauth.introspectionUrl || undefined,
    grant_types_supported: config.auth.oauth.grantTypes,
    response_types_supported: ['code'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: config.auth.oauth.scopes,
    code_challenge_methods_supported: config.auth.oauth.pkceEnabled ? ['S256'] : [],
  });
}
