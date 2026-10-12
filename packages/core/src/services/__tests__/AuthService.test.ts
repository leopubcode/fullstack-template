import { describe, expect, it } from "vitest";
import { createSystemClock } from "../../context";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidConfirmationCodeError,
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
  const confirm = () =>
    services.auth.confirmSignUp({
      email: ada.email,
      code: storage.identity.codeFor(ada.email)!,
    });
  return { storage, services, auth: services.auth, confirm };
}

describe("the auth service", () => {
  it("signs up a customer whose user id is their identity's", async () => {
    const { auth, services } = setup();

    const result = await auth.signUp(ada);

    expect(result).toEqual({
      email: ada.email,
      nextStep: "CONFIRM_SIGN_UP",
    });
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

  it("refuses to sign in before the email is confirmed", async () => {
    const { auth } = setup();
    await auth.signUp(ada);

    await expect(auth.signIn(ada)).rejects.toBeInstanceOf(
      AccountNotConfirmedError,
    );
  });

  it("refuses a wrong confirmation code", async () => {
    const { auth } = setup();
    await auth.signUp(ada);

    await expect(
      auth.confirmSignUp({ email: ada.email, code: "nope" }),
    ).rejects.toBeInstanceOf(InvalidConfirmationCodeError);
  });

  it("signs in a confirmed user and authenticates their token", async () => {
    const { auth, confirm } = setup();
    await auth.signUp(ada);
    await confirm();

    const session = await auth.signIn(ada);

    expect(session.user).toMatchObject({ email: ada.email });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(await auth.authenticate(session.accessToken)).toEqual(session.user);
  });

  it("refuses a wrong password", async () => {
    const { auth, confirm } = setup();
    await auth.signUp(ada);
    await confirm();

    await expect(
      auth.signIn({ email: ada.email, password: "wrong-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("refreshes a session with its refresh token", async () => {
    const { auth, confirm } = setup();
    await auth.signUp(ada);
    await confirm();
    const session = await auth.signIn(ada);

    const refreshed = await auth.refresh({
      refreshToken: session.refreshToken,
    });

    expect(refreshed.accessToken).not.toBe(session.accessToken);
    expect(refreshed.refreshToken).toBe(session.refreshToken);
    expect(await auth.authenticate(refreshed.accessToken)).toEqual(
      session.user,
    );
  });

  it("can't refresh after signing out", async () => {
    const { auth, confirm } = setup();
    await auth.signUp(ada);
    await confirm();
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
