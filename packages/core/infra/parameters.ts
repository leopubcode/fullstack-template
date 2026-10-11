// The SSM parameters the Resources stack writes each shared resource's name
// or ARN to, and the app stacks read them from. Unlike CloudFormation
// exports, a parameter can change while other stacks use it: they pick up the
// new value on their next deploy.
export const PARAMETERS = {
  usersTableName: "/resources/users-table-name",
  jobQueueArn: "/resources/job-queue-arn",
  jobQueueUrl: "/resources/job-queue-url",
  jobScheduleGroupName: "/resources/job-schedule-group-name",
  jobSchedulerRoleArn: "/resources/job-scheduler-role-arn",
  filesBucketName: "/resources/files-bucket-name",
  filesBucketArn: "/resources/files-bucket-arn",
} as const;
