import type { Clock } from "./domain/clock";
import type { FilesService } from "./services/FilesService";
import type { TestService } from "./services/TestService";
import type { UsersService } from "./services/UsersService";

export interface Services {
  users: UsersService;
  test: TestService;
  files: FilesService;
}

export type { Clock };

export interface AppContext {
  clock: Clock;
  services: Services;
}

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
