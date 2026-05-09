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
  const params = new URLSearchParams({
    client_id: config.auth.oauth.clientId,
    redirect_uri: config.auth.oauth.redirectUri,
    response_type: 'code',
    scope: config.auth.oauth.scopes.join(' '),
    ...(state ? { state } : {}),
  });
  return `${config.auth.oauth.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    code,
    redirect_uri: config.auth.oauth.redirectUri,
    grant_type: 'authorization_code',
  });

  if (config.auth.oauth.tokenAuthMethod !== 'client_secret_basic') {
    params.set('client_id', config.auth.oauth.clientId);
    params.set('client_secret', config.auth.oauth.clientSecret);
  }

  const response = await axios.post<OAuthTokenResponse>(
    config.auth.oauth.tokenUrl,
    params,
    { headers: buildTokenRequestHeaders() }
  );
  return response.data;
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
  const { code, state, error } = req.query as Record<string, string>;

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
    const tokenResponse = await exchangeCodeForToken(code);
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

export async function handleOAuthInitiate(_req: Request, res: Response): Promise<void> {
  const state = randomBytes(16).toString('hex');
  const authUrl = getOAuthAuthorizationUrl(state);
  res.json({
    auth_url: authUrl,
    state,
    scopes: config.auth.oauth.scopes,
    grant_types: config.auth.oauth.grantTypes,
  });
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
