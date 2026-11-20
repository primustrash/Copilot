/** Per-call, short-lived approval proofs. Signing occurs only in a trusted
 * operator workflow; no LLM-accessible endpoint may mint a grant.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

interface Grant {
  version: 1;
  tool: string;
  input_sha256: string;
  actor_sha256: string;
  expires_ms: number;
  nonce: string;
}
const consumed = new Map<string, number>();
const MAX_TTL_MS = 60000;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprintApiKey(key: string): string {
  return digest(key);
}

export function hashToolInput(input: unknown): string {
  return digest(JSON.stringify(input));
}

/** Trusted offline operator only; never expose as an MCP tool or HTTP route. */
export function signGrant(
  tool: string, input: unknown, apiKey: string, secret: string, now = Date.now(),
): string {
  if (secret.length < 32 || apiKey.length < 8 || !/^[\w.:-]{1,120}$/.test(tool)) {
    throw new Error('Incomplete operator approval configuration');
  }
  const payload: Grant = {
    version: 1, tool, input_sha256: hashToolInput(input),
    actor_sha256: fingerprintApiKey(apiKey), expires_ms: now + MAX_TTL_MS,
    nonce: randomBytes(16).toString('hex'),
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + signature;
}

export function verifyGrant(tool: string, input: unknown, actor: string, grant: string): void {
  const secret = process.env.MCP_TOOL_APPROVAL_SECRET || '';
  if (secret.length < 32 || !actor || !grant || grant.length > 4096) {
    throw new Error('Scoped tool approval unavailable');
  }
  const parts = grant.split('.');
  if (parts.length !== 2 || !parts.every(Boolean)) {
    throw new Error('Invalid scoped approval');
  }
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  let received: Buffer;
  try { received = Buffer.from(parts[1], 'base64url'); }
  catch { throw new Error('Invalid scoped approval'); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid scoped approval');
  }
  let payload: Grant;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Grant; }
  catch { throw new Error('Invalid scoped approval'); }
  const now = Date.now();
  if (payload.version !== 1 || payload.tool !== tool ||
      payload.actor_sha256 !== actor ||
      payload.input_sha256 !== hashToolInput(input) ||
      typeof payload.expires_ms !== 'number' ||
      payload.expires_ms < now || payload.expires_ms > now + MAX_TTL_MS ||
      typeof payload.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(payload.nonce)) {
    throw new Error('Scoped tool approval does not match this exact call');
  }
  for (const [key, expires] of consumed) {
    if (expires <= now) consumed.delete(key);
  }
  if (consumed.has(payload.nonce)) throw new Error('Scoped tool approval already used');
  consumed.set(payload.nonce, payload.expires_ms);
}
