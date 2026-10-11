import type { Clock } from "../../domain/clock";
import type { AddJobOptions, JobQueue } from "../../domain/jobs/jobQueue";
import type { Job } from "../../domain/jobs/types";
import { scheduleName } from "./scheduleName";

interface QueuedJob {
  body: string;
  runAt: Date;
  name: string | undefined;
}

// Test double for the job queue. Jobs are stored as the JSON body a real queue
// would carry, and run only when a test asks for the due ones.
export class InMemoryJobQueueClient implements JobQueue {
  private jobs: QueuedJob[] = [];

  constructor(private readonly clock: Clock) {}

  async add(job: Job, options?: AddJobOptions): Promise<void> {
    // As on AWS, only a job whose runAt is still ahead is deduplicated by its
    // key.
    const name =
      options?.runAt && options.runAt > this.clock.now() && options.key
        ? scheduleName(job, options.key)
        : undefined;
    if (name && this.jobs.some((queued) => queued.name === name)) {
      return;
    }
    this.jobs.push({
      body: JSON.stringify(job),
      runAt: options?.runAt ?? this.clock.now(),
      name,
    });
  }

  // Runs every job whose runAt has passed on the clock, each once, and removes
  // it from the queue before running it.
  async runDueJobs(run: (body: string) => Promise<void>): Promise<void> {
    const now = this.clock.now().getTime();
    const due = this.jobs.filter((job) => job.runAt.getTime() <= now);
    this.jobs = this.jobs.filter((job) => !due.includes(job));
    for (const job of due) {
      await run(job.body);
    }
  }
}
