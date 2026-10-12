import {
  createStorage,
  createServices,
  createSystemClock,
  handleJob,
  loadConfig,
} from "@repo/core";
import { createRunJob } from "./createRunJob";

// The composition root for running jobs. Sidequest imports this file by path
// (jobsFilePath in index.ts) when the first job is due, then looks each job's
// class up among its exports by name. Jobs run inline, in the worker process,
// so the services are built once and shared by every job.

const config = loadConfig(process.env);
const clock = createSystemClock();
const services = createServices(createStorage(config, clock), clock);

// Exported under the class name core adds every job as (RunJob in
// SidequestJobQueueClient).
export const RunJob = createRunJob((body) => handleJob(body, { services }));
