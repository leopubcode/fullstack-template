import {
  type Backend,
  DuplicatedJobError,
  JobBuilder,
  Job as SidequestJob,
} from "sidequest";
import type { AddJobOptions, JobQueue } from "../../domain/jobs/jobQueue";
import type { Job } from "../../domain/jobs/types";

// The one Sidequest job class every Job travels as. Its first argument is the
// Job's JSON body; its second, when given, is the idempotency key, there only
// so Sidequest's uniqueness digest covers it. Adding a job needs only the
// class's name: the worker's sidequest.jobs file exports the class that runs
// it, under this same name.
export class RunJob extends SidequestJob {
  run(_body: string, _key?: string): Promise<void> {
    throw new Error(
      "RunJob is only added to the queue here; the worker runs it",
    );
  }
}

// The job queue on Sidequest, in Postgres. A runAt becomes the job's
// available_at, and a key turns on Sidequest's uniqueness for jobs still
// waiting or running, over the job's arguments (its body and the key).
export class SidequestJobQueueClient implements JobQueue {
  constructor(private readonly backend: Backend) {}

  async add(job: Job, options?: AddJobOptions): Promise<void> {
    // Manual job resolution stores only the class name, for the worker to look
    // up in its jobs file, instead of this file's path, which the worker
    // doesn't share.
    const builder = new JobBuilder(this.backend, RunJob, undefined, true);
    if (options?.runAt) {
      builder.availableAt(options.runAt);
    }
    const body = JSON.stringify(job);

    try {
      if (options?.key) {
        await builder.unique({ withArgs: true }).enqueue(body, options.key);
      } else {
        await builder.enqueue(body);
      }
    } catch (error) {
      // The key is in the uniqueness digest, so a duplicate means this job
      // was already added.
      if (!isDuplicatedJobError(error)) {
        throw error;
      }
    }
  }
}

// Sidequest loads its Postgres driver with import(), so the error can come
// from the ESM copy of Sidequest while this file has the CommonJS one, and
// instanceof alone would miss it.
function isDuplicatedJobError(error: unknown): boolean {
  return (
    error instanceof DuplicatedJobError ||
    (error instanceof Error &&
      error.constructor.name === DuplicatedJobError.name)
  );
}
