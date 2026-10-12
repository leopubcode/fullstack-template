import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTokenStore } from "../tokenStore";

const tokens = { accessToken: "a", refreshToken: "r", expiresAt: 1 };

beforeEach(() => {
  localStorage.clear();
});

describe("the token store", () => {
  it("persists tokens across stores, until cleared", () => {
    createTokenStore().set(tokens);

    expect(createTokenStore().get()).toEqual(tokens);

    createTokenStore().clear();

    expect(createTokenStore().get()).toBeNull();
  });

  it("tells subscribers about every change", () => {
    const store = createTokenStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(tokens);
    store.clear();
    unsubscribe();
    store.set(tokens);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps the session in memory when storage is unavailable", () => {
    const store = createTokenStore(() => {
      throw new Error("blocked");
    });

    store.set(tokens);

    expect(store.get()).toEqual(tokens);
  });
});
