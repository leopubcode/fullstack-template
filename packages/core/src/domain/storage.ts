import type { UsersRepository } from "./users/repository";

// Every Repository and Client the services need, built together by one
// storage factory per tech (createPostgresStorage, createInMemoryStorage).
// Replace one with a spread: { ...createInMemoryStorage(), users }.
export interface Storage {
  users: UsersRepository;
}
