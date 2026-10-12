import type { User } from "./types";

export const REP_USER_ID = "rep";

export class UserModel {
  // The id is the identity provider's subject for the user, so a signed-in
  // caller's user is found by id alone.
  createCustomer(id: string, email: string, displayName: string): User {
    return {
      id,
      email,
      displayName,
      roles: ["Customer"],
    };
  }

  createRep(): User {
    return {
      id: REP_USER_ID,
      email: "rep@example.com",
      displayName: "Rep",
      roles: ["Rep"],
    };
  }
}
