import type { User } from "./types";

export const REP_USER_ID = "rep";

export class UserModel {
  createCustomer(displayName: string): User {
    return {
      id: crypto.randomUUID(),
      displayName,
      roles: ["Customer"],
    };
  }

  createRep(): User {
    return {
      id: REP_USER_ID,
      displayName: "Rep",
      roles: ["Rep"],
    };
  }
}
