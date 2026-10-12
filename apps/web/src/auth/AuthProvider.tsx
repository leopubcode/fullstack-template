import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useTRPC } from "../trpc";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./authContext";
import type { TokenStore } from "./tokenStore";

// Tracks who is signed in: the stored tokens say whether there is a session,
// and auth.me says whose. Must sit inside the TRPCProvider whose client sends
// the same store's tokens.
export function AuthProvider({
  tokens,
  children,
}: {
  tokens: TokenStore;
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(tokens.subscribe, tokens.get);

  const me = useQuery({
    ...trpc.auth.me.queryOptions(),
    enabled: session !== null,
    // An UNAUTHORIZED has already been retried by the client after a refresh.
    retry: false,
  });

  // mutateAsync is stable across renders; the mutation objects aren't.
  const { mutateAsync: signUp } = useMutation(
    trpc.auth.signUp.mutationOptions(),
  );
  const { mutateAsync: confirmSignUp } = useMutation(
    trpc.auth.confirmSignUp.mutationOptions(),
  );
  const { mutateAsync: resendConfirmationCode } = useMutation(
    trpc.auth.resendConfirmationCode.mutationOptions(),
  );
  const { mutateAsync: requestSession } = useMutation(
    trpc.auth.signIn.mutationOptions(),
  );
  const { mutateAsync: endSession } = useMutation(
    trpc.auth.signOut.mutationOptions(),
  );

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (input) => {
      const { user, ...sessionTokens } = await requestSession(input);
      // Seed me first, so the session starts signed in rather than loading.
      queryClient.setQueryData(trpc.auth.me.queryKey(), user);
      tokens.set(sessionTokens);
      return user;
    },
    [requestSession, queryClient, trpc, tokens],
  );

  const signOut = useCallback(async () => {
    const current = tokens.get();
    tokens.clear();
    // Drop everything cached for this user.
    queryClient.clear();
    if (current) {
      // Best effort: the session is over locally whether or not this lands.
      await endSession({ refreshToken: current.refreshToken }).catch(() => {});
    }
  }, [tokens, queryClient, endSession]);

  const status: AuthStatus =
    session === null || me.isError
      ? "signedOut"
      : me.data
        ? "signedIn"
        : "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: status === "signedIn" ? me.data! : null,
      signUp,
      confirmSignUp,
      resendConfirmationCode,
      signIn,
      signOut,
    }),
    [
      status,
      me.data,
      signUp,
      confirmSignUp,
      resendConfirmationCode,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
