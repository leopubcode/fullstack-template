// The export names of the Jobs stack's outputs (apps/worker/infra/JobsStack.ts).
// The API stack imports them, so the Jobs stack must be deployed first and
// can't drop or change them while the API stack uses them.
export const JOBS_EXPORTS = {
  queueArn: "Jobs-QueueArn",
  queueUrl: "Jobs-QueueUrl",
  scheduleGroupName: "Jobs-ScheduleGroupName",
  schedulerRoleArn: "Jobs-SchedulerRoleArn",
} as const;
