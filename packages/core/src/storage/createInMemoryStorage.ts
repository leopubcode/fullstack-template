import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { InMemoryFileClient } from "./FileClient/InMemoryFileClient";
import { InMemoryIdentityProviderClient } from "./IdentityProviderClient/InMemoryIdentityProviderClient";
import { InMemoryJobQueueClient } from "./JobQueueClient/InMemoryJobQueueClient";
import { InMemoryUsersRepository } from "./UsersRepository/InMemoryUsersRepository";

// Storage with its in-memory types kept, so tests can reach the doubles'
// extra methods, like jobQueue.runDueJobs or identity.verifyEmail.
export interface InMemoryStorage extends Storage {
  users: InMemoryUsersRepository;
  jobQueue: InMemoryJobQueueClient;
  files: InMemoryFileClient;
  identity: InMemoryIdentityProviderClient;
}

export function createInMemoryStorage(clock: Clock): InMemoryStorage {
  return {
    users: new InMemoryUsersRepository(),
    jobQueue: new InMemoryJobQueueClient(clock),
    files: new InMemoryFileClient(),
    identity: new InMemoryIdentityProviderClient(clock),
  };
}
