import { jobSchema, type Job, type JobType } from "../domain/jobs/types";
import type { AppContext } from "../context";

export type JobContext = Pick<AppContext, "services">;

export type JobHandlers = {
  [T in JobType]: (
    job: Extract<Job, { type: T }>,
    context: JobContext,
  ) => Promise<void>;
};

export const jobHandlers: JobHandlers = {
  Testing: (job, { services }) => services.test.doTestWork(job.foo),
};

// A job body that isn't JSON, has an unknown type, or is missing fields.
export class InvalidJobError extends Error {}

// The worker-side transport: parses a job's JSON body and hands it to the
// handler for its type.
export async function handleJob(
  body: string,
  context: JobContext,
  handlers: JobHandlers = jobHandlers,
): Promise<void> {
  const job = parseJob(body);
  await handlers[job.type](job, context);
}

function parseJob(body: string): Job {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new InvalidJobError(`Job body is not JSON: ${body}`);
  }
  const result = jobSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidJobError(`Invalid job: ${result.error.message}`);
  }
  return result.data;
}
