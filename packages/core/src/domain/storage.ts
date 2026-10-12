import type { FileProvider } from "./files/fileProvider";
import type { JobQueue } from "./jobs/jobQueue";
import type { UsersRepository } from "./users/repository";

// Every Repository and Client the services need, built together by a storage
// factory: createStorage for the real thing, createInMemoryStorage for tests.
// Replace one with a spread: { ...createInMemoryStorage(clock), users }.
export interface Storage {
  users: UsersRepository;
  jobQueue: JobQueue;
  files: FileProvider;
}
