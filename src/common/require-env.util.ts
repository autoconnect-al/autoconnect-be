export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Environment variable ${name} is required but was not provided`);
  }
  return value;
}
