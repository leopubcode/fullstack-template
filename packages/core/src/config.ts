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

export interface KeycloakConfig {
  // Keycloak's base URL, e.g. http://localhost:8080. Tokens must have been
  // issued under this same URL: their `iss` is <url>/realms/<realm>.
  url: string;
  realm: string;
  // A confidential client with direct access grants (password sign-in) and
  // a service account that can manage the realm's users.
  clientId: string;
  clientSecret: string;
  // Where the email verification link lands once followed. Must match one of
  // the client's valid redirect URIs.
  verifyEmailRedirectUri: string;
}

export function loadKeycloakConfig(env: Env): KeycloakConfig {
  return {
    url: requireEnv(env, "KEYCLOAK_URL").replace(/\/+$/, ""),
    realm: requireEnv(env, "KEYCLOAK_REALM"),
    clientId: requireEnv(env, "KEYCLOAK_CLIENT_ID"),
    clientSecret: requireEnv(env, "KEYCLOAK_CLIENT_SECRET"),
    verifyEmailRedirectUri: requireEnv(
      env,
      "KEYCLOAK_VERIFY_EMAIL_REDIRECT_URI",
    ),
  };
}

export interface Config {
  database: DatabaseConfig;
  files: FilesConfig;
  identity: KeycloakConfig;
}

export function loadConfig(env: Env): Config {
  return {
    database: loadDatabaseConfig(env),
    files: loadFilesConfig(env),
    identity: loadKeycloakConfig(env),
  };
}
