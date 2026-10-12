import path from "node:path";
import { loadConfig, sidequestBackendConfig } from "@repo/core";
import { Sidequest } from "sidequest";

// The worker: a long-running Node.js process, like the API, that polls
// Sidequest's tables in Postgres for due jobs and runs each one through the
// jobs transport. Building the services and running a job live in
// sidequest.jobs.ts, which Sidequest imports by path; this file only starts
// the engine. On SIGINT or SIGTERM, Sidequest stops claiming jobs, waits for
// the running ones and exits.

const JOBS_FILE = path.join(__dirname, "sidequest.jobs.cjs");

async function main() {
  // Fails at startup, not on the first job, when env is missing.
  const config = loadConfig(process.env);
  const dashboardPort = process.env.SIDEQUEST_DASHBOARD_PORT;

  await Sidequest.start({
    backend: sidequestBackendConfig(config.database),
    // Jobs are looked up by class name in the jobs file, not by the path of
    // the file that added them, which lives in the API's bundle.
    manualJobResolution: true,
    jobsFilePath: JOBS_FILE,
    // Run jobs in this process, with the services sidequest.jobs.ts builds
    // once, rather than in a forked process and a pool of threads.
    fork: false,
    runner: "inline",
    // The dashboard has no auth configured here, so it only runs when asked.
    dashboard: dashboardPort
      ? { enabled: true, port: Number(dashboardPort) }
      : { enabled: false },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
