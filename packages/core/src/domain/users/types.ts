export type Role = "Customer" | "Rep";

export interface User {
  id: string;
  displayName: string;
  roles: Role[];
}
