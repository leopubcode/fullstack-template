import type { UsersRepository } from "../../domain/users/repository";
import type { User } from "../../domain/users/types";

export class InMemoryUsersRepository implements UsersRepository {
  private readonly usersById = new Map<string, User>();

  async create(user: User): Promise<void> {
    this.usersById.set(user.id, user);
  }

  async getById(id: string): Promise<User | undefined> {
    return this.usersById.get(id);
  }

  async list(): Promise<User[]> {
    return Array.from(this.usersById.values());
  }
}
