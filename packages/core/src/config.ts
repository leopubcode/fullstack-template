export type Env = Record<string, string | undefined>;

export interface AwsJobQueueConfig {
  queueArn: string;
  queueUrl: string;
  scheduleGroupName: string;
  schedulerRoleArn: string;
}

export function loadJobQueueConfig(env: Env): AwsJobQueueConfig {
  return {
    queueArn: requireEnv(env, "JOB_QUEUE_ARN"),
    queueUrl: requireEnv(env, "JOB_QUEUE_URL"),
    scheduleGroupName: requireEnv(env, "JOB_SCHEDULE_GROUP_NAME"),
    schedulerRoleArn: requireEnv(env, "JOB_SCHEDULER_ROLE_ARN"),
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
    users: requireEnv(env, "USERS_TABLE_NAME"),
  };
}

export interface Config {
  jobQueue: AwsJobQueueConfig;
  tables: TablesConfig;
}

export function loadConfig(env: Env): Config {
  return {
    jobQueue: loadJobQueueConfig(env),
    tables: loadTablesConfig(env),
  };
}
