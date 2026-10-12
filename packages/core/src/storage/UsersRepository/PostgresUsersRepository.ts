import { asc, eq } from "drizzle-orm";
import type { UsersRepository } from "../../domain/users/repository";
import type { User } from "../../domain/users/types";
import type { PostgresDatabase } from "../postgresClientInstance";
import { users } from "../postgresSchema";

const userColumns = {
  id: users.id,
  displayName: users.displayName,
  roles: users.roles,
};

export class PostgresUsersRepository implements UsersRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async create(user: User): Promise<void> {
    await this.db.insert(users).values(user);
  }

  async getById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  list(): Promise<User[]> {
    return this.db
      .select(userColumns)
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id));
  }
}
