import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../../appRouter";
import { createSystemClock } from "../../context";
import { createServices } from "../../services/createServices";
import { createInMemoryStorage } from "../../storage/createInMemoryStorage";

const ada = {
  email: "Ada@Example.com",
  password: "correct-horse",
  displayName: "Ada",
};

function setup() {
  const clock = createSystemClock();
  const storage = createInMemoryStorage(clock);
  const services = createServices(storage, clock);
  const caller = (accessToken?: string) =>
    appRouter.createCaller({ clock, services, accessToken });
  return { storage, caller };
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error as TRPCError).code,
  );

describe("the auth router", () => {
  it("signs up, and once verified signs in, then answers me", async () => {
    const { storage, caller } = setup();

    await caller().auth.signUp(ada);
    storage.identity.verifyEmail("ada@example.com");
    const session = await caller().auth.signIn(ada);

    expect(await caller(session.accessToken).auth.me()).toEqual(session.user);
    expect(session.user.email).toBe("ada@example.com");
  });

  it("answers UNAUTHORIZED to me without a valid token", async () => {
    const { caller } = setup();

    expect(await codeOf(caller().auth.me())).toBe("UNAUTHORIZED");
    expect(await codeOf(caller("forged").auth.me())).toBe("UNAUTHORIZED");
  });

  it("answers each domain error with its own code", async () => {
    const { caller } = setup();
    await caller().auth.signUp(ada);

    expect(await codeOf(caller().auth.signUp(ada))).toBe("CONFLICT");
    expect(await codeOf(caller().auth.signIn(ada))).toBe("PRECONDITION_FAILED");
    expect(
      await codeOf(
        caller().auth.signIn({ email: "nobody@example.com", password: "x" }),
      ),
    ).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        caller().auth.signUp({
          ...ada,
          email: "bo@example.com",
          password: "short",
        }),
      ),
    ).toBe("BAD_REQUEST");
  });
});
