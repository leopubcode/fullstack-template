import type { Services } from "../context";
import type { Storage } from "../domain/storage";
import { UsersService } from "./UsersService";

// The one place that knows which Service needs which Repositories and
// Clients. Every composition root builds its services here, over whichever
// Storage it chose.
export function createServices(storage: Storage): Services {
  return {
    users: new UsersService(storage.users),
  };
}
