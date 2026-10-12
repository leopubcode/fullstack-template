import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import type { AppRouter } from "@repo/core";
import { refreshingLink } from "./auth/refreshingLink";
import type { TokenStore } from "./auth/tokenStore";

// The app's tRPC client: sends the stored access token with every request,
// and refreshes it once when the API answers UNAUTHORIZED.
export function createAppTRPCClient(url: string, tokens: TokenStore) {
  // Refreshes go through their own client, without the refreshing link, so
  // a failed refresh can't trigger another.
  const refreshClient = createTRPCClient<AppRouter>({
    links: [httpLink({ url })],
  });

  return createTRPCClient<AppRouter>({
    links: [
      refreshingLink({
        tokens,
        refresh: (refreshToken) =>
          refreshClient.auth.refresh.mutate({ refreshToken }),
      }),
      httpBatchLink({
        url,
        headers() {
          const current = tokens.get();
          return current
            ? { authorization: `Bearer ${current.accessToken}` }
            : {};
        },
      }),
    ],
  });
}
