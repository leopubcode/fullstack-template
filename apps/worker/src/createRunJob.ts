import { InvalidJobError } from "@repo/core";
import { Job } from "sidequest";

// Adapts Sidequest to the jobs transport: Sidequest hands RunJob one job's
// JSON body, and `handle` runs it. An error thrown by `handle` makes Sidequest
// retry the job, until its last attempt fails it. A job that can't be parsed
// fails at once, since retrying can't fix its body.
export function createRunJob(handle: (body: string) => Promise<void>) {
  return class RunJob extends Job {
    async run(body: string) {
      try {
        await handle(body);
      } catch (error) {
        if (error instanceof InvalidJobError) {
          return this.fail(error);
        }
        throw error;
      }
    }
  };
}
