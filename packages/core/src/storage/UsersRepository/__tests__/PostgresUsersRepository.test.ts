import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { User } from "../../../domain/users/types";
import { users } from "../../postgresSchema";
import {
  createTestPostgresDatabase,
  type TestPostgresDatabase,
} from "../../__tests__/testPostgresDatabase";
import { PostgresUsersRepository } from "../PostgresUsersRepository";

let postgres: TestPostgresDatabase;

const repository = () => new PostgresUsersRepository(postgres.db);

const user = (id: string): User => ({
  id,
  displayName: `User ${id}`,
  roles: ["Customer"],
});

beforeAll(async () => {
  postgres = await createTestPostgresDatabase();
});

afterAll(async () => {
  await postgres.close();
});

beforeEach(async () => {
  await postgres.db.delete(users);
});

describe("the Postgres users repository", () => {
  it("stores a created user so it can be got by id", async () => {
    await repository().create(user("u-1"));

    expect(await repository().getById("u-1")).toEqual(user("u-1"));
  });

  it("keeps every role a user holds", async () => {
    const rep: User = {
      id: "r-1",
      displayName: "Rep",
      roles: ["Rep", "Customer"],
    };

    await repository().create(rep);

    expect(await repository().getById("r-1")).toEqual(rep);
  });

  it("returns undefined for an id that isn't there", async () => {
    expect(await repository().getById("missing")).toBeUndefined();
  });

  it("refuses a second user with the same id", async () => {
    await repository().create(user("u-1"));

    await expect(repository().create(user("u-1"))).rejects.toThrow();
  });

  it("lists every stored user", async () => {
    await repository().create(user("u-1"));
    await repository().create(user("u-2"));

    const listed = await repository().list();

    expect(listed).toHaveLength(2);
    expect(listed).toEqual(expect.arrayContaining([user("u-1"), user("u-2")]));
  });
});
