// The export names of the Jobs stack's files bucket outputs
// (apps/worker/infra/JobsStack.ts). The API stack imports them, so the Jobs
// stack must be deployed first and can't drop or change them while the API
// stack uses them.
export const FILES_EXPORTS = {
  bucketName: "Files-BucketName",
  bucketArn: "Files-BucketArn",
} as const;
