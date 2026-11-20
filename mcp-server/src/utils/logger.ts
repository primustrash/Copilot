import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = process.env.LOG_FILE || '/var/log/mcp-server/app.log';
const AUDIT_LOG_FILE = process.env.AUDIT_LOG_FILE || '/var/log/mcp-server/audit.log';

// Ensure log directories exist
try {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch {
  // Fallback to console only if log dir can't be created
}

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat }),
];

try {
  transports.push(
    new winston.transports.File({ filename: LOG_FILE, format: fileFormat })
  );
} catch {
  // ignore if file transport fails
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
});

// Separate audit logger
const auditTransports: winston.transport[] = [];
try {
  auditTransports.push(
    new winston.transports.File({ filename: AUDIT_LOG_FILE, format: fileFormat })
  );
} catch {
  // fallback
}
auditTransports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, message, ...meta }) => {
        return `[AUDIT] ${timestamp} ${message} ${JSON.stringify(meta)}`;
      })
    ),
  })
);

export const auditLogger = winston.createLogger({
  level: 'info',
  transports: auditTransports,
});

export function logToolExecution(tool: string, _input: unknown, result: unknown, durationMs: number): void {
  // Tool arguments, results and exceptions can contain credentials or PII.
  // Log only bounded metadata, never their source values.
  const safeName = /^[A-Za-z0-9_.:-]{1,100}$/.test(tool) ? tool : 'invalid-tool-id';
  const failed = Boolean(
    result && typeof result === 'object' &&
    'isError' in result && (result as { isError?: unknown }).isError === true
  );
  auditLogger.info('tool_executed', {
    tool: safeName,
    outcome: failed ? 'error' : 'completed',
    durationMs: Number.isFinite(durationMs)
      ? Math.max(0, Math.min(Math.round(durationMs), 3600000)) : null,
    timestamp: new Date().toISOString(),
  });
}
