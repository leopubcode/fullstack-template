import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { InMemoryJobQueueClient } from "./JobQueueClient/InMemoryJobQueueClient";

// Storage with its in-memory types kept, so tests can reach the doubles'
// extra methods, like jobQueue.runDueJobs.
export interface InMemoryStorage extends Storage {
  jobQueue: InMemoryJobQueueClient;
}

export function createInMemoryStorage(clock: Clock): InMemoryStorage {
  return {
    jobQueue: new InMemoryJobQueueClient(clock),
  };
}
