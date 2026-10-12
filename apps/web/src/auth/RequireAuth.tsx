import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

// Renders its children only for a signed-in user; sends anyone else to sign
// in, remembering where they were going.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }
  if (status === "signedOut") {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  return children;
}
