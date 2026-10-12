import type { Clock } from "../../domain/clock";
import type { AddJobOptions, JobQueue } from "../../domain/jobs/jobQueue";
import type { Job } from "../../domain/jobs/types";

interface QueuedJob {
  body: string;
  runAt: Date;
  key: string | undefined;
}

// Test double for the job queue. Jobs are stored as the JSON body a real queue
// would carry, and run only when a test asks for the due ones.
export class InMemoryJobQueueClient implements JobQueue {
  private jobs: QueuedJob[] = [];

  constructor(private readonly clock: Clock) {}

  async add(job: Job, options?: AddJobOptions): Promise<void> {
    const body = JSON.stringify(job);
    const key = options?.key;
    // As on Sidequest, the same job with the same key is added once while it
    // is still queued.
    if (
      key &&
      this.jobs.some((queued) => queued.key === key && queued.body === body)
    ) {
      return;
    }
    this.jobs.push({ body, runAt: options?.runAt ?? this.clock.now(), key });
  }

  // Runs every job whose runAt has passed on the clock, each once. A job
  // leaves the queue only once it has run, so its key stays taken while it
  // runs, and a job that throws stays queued, as Sidequest would retry it.
  async runDueJobs(run: (body: string) => Promise<void>): Promise<void> {
    const now = this.clock.now().getTime();
    const due = this.jobs.filter((job) => job.runAt.getTime() <= now);
    for (const job of due) {
      await run(job.body);
      this.jobs = this.jobs.filter((queued) => queued !== job);
    }
  }
}
