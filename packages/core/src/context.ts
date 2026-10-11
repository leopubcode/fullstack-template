import type { TestService } from "./services/TestService";
import type { Clock } from "./domain/clock";

export interface Services {
  test: TestService;
}

export type { Clock };

export interface AppContext {
  clock: Clock;
  services: Services;
}

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
