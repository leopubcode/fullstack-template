import type { Job } from "./types";

export interface AddJobOptions {
  // Run no earlier than this. Without it, the job runs as soon as possible.
  runAt?: Date;
  // Idempotency key for a job whose runAt is still ahead: adding a job of the
  // same type with the same key again adds nothing, and doesn't fail. Ignored
  // for a job that is already due, so handlers must tolerate running twice.
  key?: string;
}

// Where services add jobs. Services never know which queue, scheduler or
// runtime sits behind it.
export interface JobQueue {
  add(job: Job, options?: AddJobOptions): Promise<void>;
}
