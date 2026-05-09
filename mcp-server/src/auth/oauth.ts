import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
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

export function getOAuthAuthorizationUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: config.auth.oauth.clientId,
    redirect_uri: config.auth.oauth.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    ...(state ? { state } : {}),
  });
  return `${config.auth.oauth.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
  const response = await axios.post<OAuthTokenResponse>(
    config.auth.oauth.tokenUrl,
    new URLSearchParams({
      code,
      client_id: config.auth.oauth.clientId,
      client_secret: config.auth.oauth.clientSecret,
      redirect_uri: config.auth.oauth.redirectUri,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data;
}

export async function getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const response = await axios.get<OAuthUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export function generateJWT(payload: object): string {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiry } as jwt.SignOptions);
}

export function verifyJWT(token: string): jwt.JwtPayload | string {
  return jwt.verify(token, config.auth.jwtSecret);
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
  const state = Math.random().toString(36).substring(7);
  const authUrl = getOAuthAuthorizationUrl(state);
  res.json({ auth_url: authUrl, state });
}
