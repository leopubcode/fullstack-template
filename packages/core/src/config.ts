export type Env = Record<string, string | undefined>;

// The env var each config value is read from. The infra's resource accesses
// (infra/SharedResources.ts) set these same names on a Lambda.
export const ENV = {
  jobQueueArn: "JOB_QUEUE_ARN",
  jobQueueUrl: "JOB_QUEUE_URL",
  jobScheduleGroupName: "JOB_SCHEDULE_GROUP_NAME",
  jobSchedulerRoleArn: "JOB_SCHEDULER_ROLE_ARN",
  usersTableName: "USERS_TABLE_NAME",
  filesBucketName: "FILES_BUCKET_NAME",
  cognitoUserPoolId: "COGNITO_USER_POOL_ID",
  cognitoClientId: "COGNITO_CLIENT_ID",
  cognitoIssuerUrl: "COGNITO_ISSUER_URL",
} as const;

export interface AwsJobQueueConfig {
  queueArn: string;
  queueUrl: string;
  scheduleGroupName: string;
  schedulerRoleArn: string;
}

export function loadJobQueueConfig(env: Env): AwsJobQueueConfig {
  return {
    queueArn: requireEnv(env, ENV.jobQueueArn),
    queueUrl: requireEnv(env, ENV.jobQueueUrl),
    scheduleGroupName: requireEnv(env, ENV.jobScheduleGroupName),
    schedulerRoleArn: requireEnv(env, ENV.jobSchedulerRoleArn),
  };
}

function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export interface TablesConfig {
  users: string;
}

export function loadTablesConfig(env: Env): TablesConfig {
  return {
    users: requireEnv(env, ENV.usersTableName),
  };
}

export interface FilesConfig {
  bucketName: string;
}

export function loadFilesConfig(env: Env): FilesConfig {
  return {
    bucketName: requireEnv(env, ENV.filesBucketName),
  };
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  // The tokens' `iss` claim; its JWKS is served under /.well-known/jwks.json.
  // Explicit rather than derived from the region, so an emulator's issuer
  // (cognito-local) works too.
  issuerUrl: string;
}

export function loadCognitoConfig(env: Env): CognitoConfig {
  return {
    userPoolId: requireEnv(env, ENV.cognitoUserPoolId),
    clientId: requireEnv(env, ENV.cognitoClientId),
    issuerUrl: requireEnv(env, ENV.cognitoIssuerUrl),
  };
}

export interface Config {
  jobQueue: AwsJobQueueConfig;
  tables: TablesConfig;
  files: FilesConfig;
  identity: CognitoConfig;
}

export function loadConfig(env: Env): Config {
  return {
    jobQueue: loadJobQueueConfig(env),
    tables: loadTablesConfig(env),
    files: loadFilesConfig(env),
    identity: loadCognitoConfig(env),
  };
}
