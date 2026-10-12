import type { Job } from "./types";

export interface AddJobOptions {
  // Run no earlier than this. Without it, or once it has passed, the job runs
  // as soon as possible.
  runAt?: Date;
  // Idempotency key: while a job added with this key is still waiting or
  // running, adding the same job with the same key again adds nothing, and
  // doesn't fail. Once that job has finished, the key is free again, so
  // handlers must still tolerate running twice.
  key?: string;
}

// Where services add jobs. Services never know which queue, scheduler or
// runtime sits behind it.
export interface JobQueue {
  add(job: Job, options?: AddJobOptions): Promise<void>;
}
