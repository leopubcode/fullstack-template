import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createTRPCClient, unstable_localLink } from "@trpc/client";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  type AppRouter,
  appRouter,
  createInMemoryStorage,
  createServices,
} from "@repo/core";
import { TRPCProvider } from "../../trpc";
import { AuthProvider } from "../AuthProvider";
import { refreshingLink } from "../refreshingLink";
import { createTokenStore } from "../tokenStore";
import { useAuth } from "../useAuth";

const HOUR = 60 * 60 * 1000;
const ada = {
  email: "ada@example.com",
  password: "correct-horse",
  displayName: "Ada",
};

// The real router over in-memory storage, called in-process. The client is
// built like the app's: the refreshing link in front, refreshes through a
// client without it.
async function setup() {
  let now = Date.now();
  const clock = { now: () => new Date(now) };
  const storage = createInMemoryStorage(clock);
  const services = createServices(storage, clock);
  const tokens = createTokenStore(() => sessionStorage);
  tokens.clear();

  const localLink = () =>
    unstable_localLink<AppRouter>({
      router: appRouter,
      createContext: async () => ({
        clock,
        services,
        accessToken: tokens.get()?.accessToken,
      }),
    });
  const refreshClient = createTRPCClient<AppRouter>({ links: [localLink()] });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      refreshingLink({
        tokens,
        refresh: (refreshToken) =>
          refreshClient.auth.refresh.mutate({ refreshToken }),
      }),
      localLink(),
    ],
  });
  const queryClient = new QueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <AuthProvider tokens={tokens}>{children}</AuthProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );

  // A confirmed account, ready to sign in.
  await services.auth.signUp(ada);
  await services.auth.confirmSignUp({
    email: ada.email,
    code: storage.identity.codeFor(ada.email)!,
  });

  return {
    tokens,
    queryClient,
    advance: (ms: number) => (now += ms),
    render: () => renderHook(useAuth, { wrapper }),
  };
}

describe("useAuth", () => {
  it("starts signed out without stored tokens", async () => {
    const { render } = await setup();

    const { result } = render();

    expect(result.current.status).toBe("signedOut");
    expect(result.current.user).toBeNull();
  });

  it("signs in and out", async () => {
    const { render, tokens } = await setup();
    const { result } = render();

    await act(() => result.current.signIn(ada));

    expect(result.current.status).toBe("signedIn");
    expect(result.current.user).toMatchObject({ email: ada.email });
    expect(tokens.get()).not.toBeNull();

    await act(() => result.current.signOut());

    expect(result.current.status).toBe("signedOut");
    expect(tokens.get()).toBeNull();
  });

  it("restores a stored session as the same user", async () => {
    const { render, tokens, queryClient } = await setup();
    const first = render();
    await act(() => first.result.current.signIn(ada));
    first.unmount();
    queryClient.clear();

    const { result } = render();

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    expect(result.current.user).toMatchObject({ email: ada.email });
    expect(tokens.get()).not.toBeNull();
  });

  it("refreshes an expired access token and stays signed in", async () => {
    const { render, tokens, queryClient, advance } = await setup();
    const first = render();
    await act(() => first.result.current.signIn(ada));
    const expired = tokens.get()!.accessToken;
    first.unmount();
    queryClient.clear();
    advance(2 * HOUR);

    const { result } = render();

    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    expect(tokens.get()!.accessToken).not.toBe(expired);
  });

  it("signs out when the refresh token is rejected too", async () => {
    const { render, tokens, queryClient, advance } = await setup();
    const first = render();
    await act(() => first.result.current.signIn(ada));
    first.unmount();
    queryClient.clear();
    advance(2 * HOUR);
    tokens.set({ ...tokens.get()!, refreshToken: "revoked" });

    const { result } = render();

    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    expect(tokens.get()).toBeNull();
  });

  it("throws outside an AuthProvider", () => {
    expect(() => renderHook(useAuth)).toThrow(/AuthProvider/);
  });
});
