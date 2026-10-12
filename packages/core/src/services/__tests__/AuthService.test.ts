import { describe, expect, it } from "vitest";
import { createSystemClock } from "../../context";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidCredentialsError,
  NotAuthenticatedError,
} from "../../domain/identity/errors";
import { createInMemoryStorage } from "../../storage/createInMemoryStorage";
import { createServices } from "../createServices";

const ada = {
  email: "ada@example.com",
  password: "correct-horse",
  displayName: "Ada",
};

function setup() {
  const clock = createSystemClock();
  const storage = createInMemoryStorage(clock);
  const services = createServices(storage, clock);
  const verify = () => storage.identity.verifyEmail(ada.email);
  return { storage, services, auth: services.auth, verify };
}

describe("the auth service", () => {
  it("signs up a customer whose user id is their identity's", async () => {
    const { auth, services } = setup();

    const result = await auth.signUp(ada);

    expect(result).toEqual({ email: ada.email, nextStep: "VERIFY_EMAIL" });
    expect(await services.users.list()).toContainEqual({
      id: expect.any(String),
      email: ada.email,
      displayName: "Ada",
      roles: ["Customer"],
    });
  });

  it("refuses a second account for the same email", async () => {
    const { auth } = setup();
    await auth.signUp(ada);

    await expect(auth.signUp(ada)).rejects.toBeInstanceOf(AccountExistsError);
  });

  it("refuses to sign in before the email is verified", async () => {
    const { auth } = setup();
    await auth.signUp(ada);

    await expect(auth.signIn(ada)).rejects.toBeInstanceOf(
      AccountNotConfirmedError,
    );
  });

  it("resends the verification email only to an unverified account", async () => {
    const { auth, storage, verify } = setup();
    await auth.signUp(ada);

    await auth.resendVerification({ email: ada.email });
    expect(storage.identity.verificationEmailsSentTo(ada.email)).toBe(2);

    verify();
    await auth.resendVerification({ email: ada.email });
    expect(storage.identity.verificationEmailsSentTo(ada.email)).toBe(2);

    await expect(
      auth.resendVerification({ email: "nobody@example.com" }),
    ).resolves.toBeUndefined();
  });

  it("signs in a verified user and authenticates their token", async () => {
    const { auth, verify } = setup();
    await auth.signUp(ada);
    verify();

    const session = await auth.signIn(ada);

    expect(session.user).toMatchObject({ email: ada.email });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(await auth.authenticate(session.accessToken)).toEqual(session.user);
  });

  it("refuses a wrong password", async () => {
    const { auth, verify } = setup();
    await auth.signUp(ada);
    verify();

    await expect(
      auth.signIn({ email: ada.email, password: "wrong-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("refreshes a session with its refresh token", async () => {
    const { auth, verify } = setup();
    await auth.signUp(ada);
    verify();
    const session = await auth.signIn(ada);

    const refreshed = await auth.refresh({
      refreshToken: session.refreshToken,
    });

    expect(refreshed.accessToken).not.toBe(session.accessToken);
    expect(await auth.authenticate(refreshed.accessToken)).toEqual(
      session.user,
    );
  });

  it("can't refresh after signing out", async () => {
    const { auth, verify } = setup();
    await auth.signUp(ada);
    verify();
    const session = await auth.signIn(ada);

    await auth.signOut({ refreshToken: session.refreshToken });

    await expect(
      auth.refresh({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  it("rejects a missing or unknown token", async () => {
    const { auth } = setup();

    await expect(auth.authenticate(undefined)).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
    await expect(auth.authenticate("forged")).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
  });
});
