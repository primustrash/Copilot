import { z } from "zod";

/** Validate that a string looks like a hostname, IP, or CIDR range. */
export const TargetSchema = z
  .string()
  .min(1)
  .regex(
    /^[\w.\-/:]+$/,
    "Target must be a hostname, IP address, or CIDR range"
  );

/** Validate a URL (http/https only). */
export const UrlSchema = z.string().url().startsWith("http");

/** Validate a port number. */
export const PortSchema = z.number().int().min(1).max(65535);

/** Validate a comma-separated port list like "80,443,8080" or a range "1-1024". */
export const PortListSchema = z.string().regex(/^[\d,\-]+$/, "Invalid port list");

/** Validate an optional timeout value in seconds. */
export const TimeoutSchema = z.number().int().min(1).max(3600).default(120);

/** Strip shell-dangerous characters from a string argument. */
export function sanitizeArg(value: string): string {
  return value.replace(/[;&|`$<>(){}\\'"]/g, "");
}

/** Build a flat array of CLI flags from an object of flag→value pairs. */
export function buildFlags(
  flags: Record<string, string | number | boolean | undefined>
): string[] {
  const out: string[] = [];
  for (const [flag, value] of Object.entries(flags)) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      out.push(flag);
    } else {
      out.push(flag, String(value));
    }
  }
  return out;
}
