import type { Job } from "../../domain/jobs/types";

// The name a scheduled job is stored under. A key is scoped to the job's type,
// so the same key on two job types never collides.
export function scheduleName(job: Job, key: string): string {
  return `${job.type}-${key}`;
}
