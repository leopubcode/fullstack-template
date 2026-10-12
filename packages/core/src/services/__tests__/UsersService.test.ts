import { describe, expect, it } from "vitest";
import { InMemoryUsersRepository } from "../../storage/UsersRepository/InMemoryUsersRepository";
import { UsersService } from "../UsersService";

const ada = { id: "sub-1", email: "ada@example.com", displayName: "Ada" };

describe("the users service", () => {
  it("creates a customer under their identity's id and stores them", async () => {
    const service = new UsersService(new InMemoryUsersRepository());

    const user = await service.createCustomer(ada);

    expect(user).toEqual({
      id: "sub-1",
      email: "ada@example.com",
      displayName: "Ada",
      roles: ["Customer"],
    });
    expect(await service.getById(user.id)).toEqual(user);
  });

  it("lists the stored users", async () => {
    const service = new UsersService(new InMemoryUsersRepository());

    const user = await service.createCustomer(ada);

    expect(await service.list()).toContainEqual(user);
  });
});
