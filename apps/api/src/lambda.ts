import {
  createAwsStorage,
  createServices,
  createSystemClock,
  loadConfig,
} from "@repo/core";
import { createHandler } from "./createHandler";

// The Lambda runtime adapter and composition root: builds the services from
// env once per cold start and hands the same ones to every request.

const config = loadConfig(process.env);
const clock = createSystemClock();
const services = createServices(createAwsStorage(config, clock), clock);

export const handler = createHandler({ clock, services });
