import type { Storage } from "../domain/storage";
import { InMemoryUsersRepository } from "./UsersRepository/InMemoryUsersRepository";

// Storage with its in-memory types kept, so tests can reach the doubles'
// extra methods.
export interface InMemoryStorage extends Storage {
  users: InMemoryUsersRepository;
}

export function createInMemoryStorage(): InMemoryStorage {
  return {
    users: new InMemoryUsersRepository(),
  };
}
