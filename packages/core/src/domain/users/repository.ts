import type { User } from "./types";

export interface UsersRepository {
  create(user: User): Promise<void>;
  getById(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}
