import type { JobQueue } from "./jobs/jobQueue";

// Every Repository and Client the services need, built together by one
// storage factory per tech (createAwsStorage, createInMemoryStorage). Replace
// one with a spread: { ...createInMemoryStorage(clock), jobQueue }.
export interface Storage {
  jobQueue: JobQueue;
}
