import type { Services } from "../context";
import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { AuthService } from "./AuthService";
import { FilesService } from "./FilesService";
import { TestService } from "./TestService";
import { UsersService } from "./UsersService";

// The one place that knows which Service needs which Repositories and
// Clients. Every composition root builds its services here, over whichever
// Storage it chose.
export function createServices(storage: Storage, clock: Clock): Services {
  const users = new UsersService(storage.users);
  return {
    users,
    auth: new AuthService(storage.identity, users),
    test: new TestService(storage.jobQueue, clock),
    files: new FilesService(storage.files),
  };
}
