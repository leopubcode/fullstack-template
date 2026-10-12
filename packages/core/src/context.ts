import type { Clock } from "./domain/clock";
import type { AuthService } from "./services/AuthService";
import type { FilesService } from "./services/FilesService";
import type { TestService } from "./services/TestService";
import type { UsersService } from "./services/UsersService";

export interface Services {
  users: UsersService;
  auth: AuthService;
  test: TestService;
  files: FilesService;
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
