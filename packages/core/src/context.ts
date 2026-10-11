import type { TestService } from "./services/TestService";
import type { Clock } from "./domain/clock";
import type { UsersService } from "./services/UsersService";

export interface Services {
  test: TestService;
  users: UsersService;
}

export type { Clock };

export interface AppContext {
  clock: Clock;
  services: Services;
}

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
