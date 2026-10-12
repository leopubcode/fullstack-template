import { describe, expect, it } from "vitest";
import { InMemoryUsersRepository } from "../../storage/UsersRepository/InMemoryUsersRepository";
import { UsersService } from "../UsersService";

describe("the users service", () => {
  it("signs up a new customer and stores them", async () => {
    const service = new UsersService(new InMemoryUsersRepository());

    const user = await service.signUp({ displayName: "Ada" });

    expect(user).toEqual({
      id: expect.any(String),
      displayName: "Ada",
      roles: ["Customer"],
    });
    expect(await service.getById(user.id)).toEqual(user);
  });

  it("gives every customer their own id", async () => {
    const service = new UsersService(new InMemoryUsersRepository());

    const first = await service.signUp({ displayName: "Ada" });
    const second = await service.signUp({ displayName: "Ada" });

    expect(second.id).not.toBe(first.id);
  });

  it("lists the stored users", async () => {
    const service = new UsersService(new InMemoryUsersRepository());

    const user = await service.signUp({ displayName: "Ada" });

    expect(await service.list()).toContainEqual(user);
  });
});
