export type Role = "Customer" | "Rep";

export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
}
