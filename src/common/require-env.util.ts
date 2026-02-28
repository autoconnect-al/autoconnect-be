import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

let didLoadDotenv = false;

function loadDotenvIfNeeded() {
  if (didLoadDotenv) return;
  didLoadDotenv = true;

  // Respect explicit runtime path when provided.
  const explicitPath = process.env.DOTENV_CONFIG_PATH;
  if (explicitPath && explicitPath.trim().length > 0) {
    config({ path: explicitPath.trim() });
    return;
  }

  // Fallback to project-level .env in current working directory.
  const defaultEnvPath = resolve(process.cwd(), '.env');
  if (existsSync(defaultEnvPath)) {
    config({ path: defaultEnvPath });
    return;
  }

  // Final fallback to dotenv defaults.
  config();
}

export function requireEnv(name: string): string {
  loadDotenvIfNeeded();
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Environment variable ${name} is required but was not provided`);
  }
  return value;
}
