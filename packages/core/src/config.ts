export type Env = Record<string, string | undefined>;

function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export interface DatabaseConfig {
  url: string;
}

export function loadDatabaseConfig(env: Env): DatabaseConfig {
  return {
    url: requireEnv(env, "DATABASE_URL"),
  };
}

export interface Config {
  database: DatabaseConfig;
}

export function loadConfig(env: Env): Config {
  return {
    database: loadDatabaseConfig(env),
  };
}
