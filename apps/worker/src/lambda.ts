import type { SQSHandler } from "aws-lambda";
import {
  createAwsStorage,
  createServices,
  createSystemClock,
  handleJob,
  loadConfig,
} from "@repo/core";
import { handleSqsEvent } from "./handleSqsEvent";

// The Lambda runtime adapter and composition root: builds the services from
// env and runs each SQS record through the jobs transport. Running jobs on
// another runtime means writing another file like this one, not changing core.

const config = loadConfig(process.env);
const clock = createSystemClock();
const services = createServices(createAwsStorage(config, clock), clock);

export const handler: SQSHandler = (event) =>
  handleSqsEvent(event, { handle: (body) => handleJob(body, { services }) });
