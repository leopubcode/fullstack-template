import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { InMemoryJobQueueClient } from "./JobQueueClient/InMemoryJobQueueClient";
import { InMemoryUsersRepository } from "./UsersRepository/InMemoryUsersRepository";

// Storage with its in-memory types kept, so tests can reach the doubles'
// extra methods, like jobQueue.runDueJobs.
export interface InMemoryStorage extends Storage {
  users: InMemoryUsersRepository;
  jobQueue: InMemoryJobQueueClient;
}

export function createInMemoryStorage(clock: Clock): InMemoryStorage {
  return {
    users: new InMemoryUsersRepository(),
    jobQueue: new InMemoryJobQueueClient(clock),
  };
}
