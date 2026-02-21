type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYWORDS = ['authorization', 'token', 'secret', 'password'];

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(input)) {
      const lower = key.toLowerCase();
      const shouldRedact = SENSITIVE_KEYWORDS.some((word) =>
        lower.includes(word),
      );
      output[key] = shouldRedact ? '[REDACTED]' : redactValue(inner);
    }
    return output;
  }

  return value;
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta === undefined ? {} : { meta: redactValue(meta) }),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) =>
      write('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => write('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => write('warn', scope, message, meta),
    error: (message: string, meta?: unknown) =>
      write('error', scope, message, meta),
  };
}
