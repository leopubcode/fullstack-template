import type { AuthService } from "./services/AuthService";
import type { TestService } from "./services/TestService";
import type { Clock } from "./domain/clock";
import type { UsersService } from "./services/UsersService";

export interface Services {
  auth: AuthService;
  test: TestService;
  users: UsersService;
}

export type { Clock };

export interface AppContext {
  clock: Clock;
  services: Services;
  // The caller's bearer token, read from the request by the runtime adapter.
  accessToken?: string;
}

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
