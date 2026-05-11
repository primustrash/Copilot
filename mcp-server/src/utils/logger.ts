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

export function logToolExecution(tool: string, input: unknown, result: unknown, durationMs: number): void {
  auditLogger.info('tool_executed', {
    tool,
    input,
    result,
    durationMs,
    timestamp: new Date().toISOString(),
  });
}
