import { z } from "zod";
import { isIP } from "node:net";

/**
 * Explicitly scoped network testing. No implicit home/LAN access.
 * No DNS lookups here: only literal IPv4 targets pre-authorized by the
 * server operator are accepted, preventing DNS rebinding for these tools.
 * Caller-provided URL or scope parameters cannot expand the allowlist.
 */
export function isAuthorizedTarget(value: string): boolean {
  if (typeof value !== "string" || isIP(value) !== 4) return false;
  const allowlist = (process.env.SECURITY_ADDON_ALLOWED_TARGET_IPS || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  if (!allowlist.length || allowlist.some(x => isIP(x) !== 4)) return false;
  return allowlist.includes(value);
}

export const TargetSchema = z.string().refine(
  isAuthorizedTarget,
  "Target is not an operator-approved literal IPv4 address"
);

export const UrlSchema = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      isAuthorizedTarget(url.hostname) && !url.hash;
  } catch {
    return false;
  }
}, "HTTPS URL must use an operator-approved literal IP (no DNS/credentials)");

export const PortSchema = z.number().int().min(1).max(65535);
export const PortListSchema = z.string().regex(/^\d{1,5}(?:[-,]\d{1,5})*$/, "Invalid port list")
  .refine(value => value.split(/[,-]/).every(port => Number(port) >= 1 && Number(port) <= 65535),
    "Invalid TCP port");

export const TimeoutSchema = z.number().int().min(1).max(120).default(30);

export function sanitizeArg(value: string): string {
  if (!/^[A-Za-z0-9,._:/-]{1,255}$/.test(value)) {
    throw new Error("Invalid argument characters");
  }
  return value;
}

export function buildFlags(
  flags: Record<string, string | number | boolean | undefined>
): string[] {
  const out: string[] = [];
  for (const [flag, value] of Object.entries(flags)) {
    if (!/^--[A-Za-z0-9-]{1,50}$/.test(flag)) throw new Error("Unexpected option");
    if (value === undefined || value === false) continue;
    if (value === true) out.push(flag);
    else out.push(flag, sanitizeArg(String(value)));
  }
  return out;
}
