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

export interface FilesConfig {
  bucketName: string;
}

export function loadFilesConfig(env: Env): FilesConfig {
  return {
    bucketName: requireEnv(env, "FILES_BUCKET_NAME"),
  };
}

export interface Config {
  database: DatabaseConfig;
  files: FilesConfig;
}

export function loadConfig(env: Env): Config {
  return {
    database: loadDatabaseConfig(env),
    files: loadFilesConfig(env),
  };
}
