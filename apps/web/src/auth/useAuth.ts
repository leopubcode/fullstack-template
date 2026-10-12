import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./authContext";

// The current auth state and the actions that change it. Needs an
// AuthProvider above it.
export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return auth;
}
