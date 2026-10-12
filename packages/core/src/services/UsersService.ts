import { UserModel } from "../domain/users/model";
import type { UsersRepository } from "../domain/users/repository";
import type { User } from "../domain/users/types";

export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly model: UserModel = new UserModel(),
  ) {}

  async createCustomer(input: {
    id: string;
    email: string;
    displayName: string;
  }): Promise<User> {
    const user = this.model.createCustomer(
      input.id,
      input.email,
      input.displayName,
    );
    await this.repository.create(user);
    return user;
  }

  list(): Promise<User[]> {
    return this.repository.list();
  }

  getById(id: string): Promise<User | undefined> {
    return this.repository.getById(id);
  }
}
