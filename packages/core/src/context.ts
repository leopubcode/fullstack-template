import type { UsersService } from "./services/UsersService";

export interface Services {
  users: UsersService;
}

export interface AppContext {
  services: Services;
}
