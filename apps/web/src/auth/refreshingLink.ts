import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable, type Unsubscribable } from "@trpc/server/observable";
import type { AppRouter, AuthSession } from "@repo/core";
import type { TokenStore } from "./tokenStore";

// Procedures whose UNAUTHORIZED means bad credentials, not an expired access
// token, so refreshing and retrying would be pointless.
const NO_RETRY = new Set(["auth.signIn", "auth.refresh", "auth.signOut"]);

export function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED"
  );
}

// Retries an operation once after an UNAUTHORIZED, with tokens refreshed by
// `refresh`. Concurrent failures share one refresh. If the refresh token is
// itself rejected, the session is over: the store is cleared.
export function refreshingLink(options: {
  tokens: TokenStore;
  refresh: (refreshToken: string) => Promise<AuthSession>;
}): TRPCLink<AppRouter> {
  let inFlight: Promise<boolean> | null = null;

  const refreshOnce = () => {
    inFlight ??= (async () => {
      const current = options.tokens.get();
      if (!current) {
        return false;
      }
      try {
        const session = await options.refresh(current.refreshToken);
        options.tokens.set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        });
        return true;
      } catch (error) {
        if (isUnauthorized(error)) {
          options.tokens.clear();
        }
        return false;
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return () =>
    ({ op, next }) =>
      observable((observer) => {
        let subscription: Unsubscribable | undefined;
        let closed = false;

        const attempt = (canRetry: boolean) => {
          subscription = next(op).subscribe({
            next: (value) => observer.next(value),
            complete: () => observer.complete(),
            error: (error) => {
              if (
                !canRetry ||
                NO_RETRY.has(op.path) ||
                !isUnauthorized(error) ||
                !options.tokens.get()
              ) {
                observer.error(error);
                return;
              }
              void refreshOnce().then((refreshed) => {
                if (closed) {
                  return;
                }
                if (refreshed) {
                  attempt(false);
                } else {
                  observer.error(error);
                }
              });
            },
          });
        };

        attempt(true);
        return () => {
          closed = true;
          subscription?.unsubscribe();
        };
      });
}
