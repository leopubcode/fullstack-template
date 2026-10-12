import { createContext } from "react";
import type { SignUpResult, User } from "@repo/core";

export type AuthStatus = "loading" | "signedIn" | "signedOut";

export interface AuthContextValue {
  status: AuthStatus;
  // The signed-in user, or null unless status is "signedIn".
  user: User | null;
  signUp(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<SignUpResult>;
  confirmSignUp(input: { email: string; code: string }): Promise<void>;
  resendConfirmationCode(input: { email: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<User>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
