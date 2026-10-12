import {
  CodeMismatchException,
  CognitoIdentityProviderClient as CognitoSdkClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  InvalidPasswordException,
  NotAuthorizedException,
  RevokeTokenCommand,
  SignUpCommand,
  UserNotConfirmedException,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { mockClient } from "aws-sdk-client-mock";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidConfirmationCodeError,
  InvalidCredentialsError,
  NotAuthenticatedError,
} from "../../../domain/identity/errors";
import { CognitoIdentityProviderClient } from "../CognitoIdentityProviderClient";

const config = {
  userPoolId: "pool",
  clientId: "client",
  issuerUrl: "https://issuer.test/pool",
};
const NOW = new Date("2026-01-01T00:00:00Z");
const NOW_SECONDS = NOW.getTime() / 1000;
const clock = { now: () => NOW };

const cognito = mockClient(CognitoSdkClient);

let privateKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  // jose fetches the JWKS from <issuer>/.well-known/jwks.json.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ keys: [jwk] })),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  cognito.reset();
});

const client = () =>
  new CognitoIdentityProviderClient(config, clock, new CognitoSdkClient({}));

function accessToken(claims: Record<string, unknown> = {}) {
  return new SignJWT({
    token_use: "access",
    client_id: "client",
    sub: "sub-1",
    iss: config.issuerUrl,
    iat: NOW_SECONDS,
    exp: NOW_SECONDS + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .sign(privateKey);
}

describe("the Cognito identity provider client", () => {
  it("registers an account with its email", async () => {
    cognito
      .on(SignUpCommand)
      .resolves({ UserSub: "sub-1", UserConfirmed: false });

    expect(await client().register("a@example.com", "pw")).toEqual({
      subject: "sub-1",
    });
    expect(cognito.commandCalls(SignUpCommand)[0]!.args[0].input).toEqual({
      ClientId: "client",
      Username: "a@example.com",
      Password: "pw",
      UserAttributes: [{ Name: "email", Value: "a@example.com" }],
    });
  });

  it("signs in with the password flow and verifies the token", async () => {
    const token = await accessToken();
    cognito.on(InitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: token,
        RefreshToken: "refresh",
        ExpiresIn: 60,
      },
    });

    expect(await client().signIn("a@example.com", "pw")).toEqual({
      subject: "sub-1",
      accessToken: token,
      refreshToken: "refresh",
      // From the token's exp claim, not ExpiresIn.
      expiresAt: NOW.getTime() + 3600 * 1000,
    });
    expect(
      cognito.commandCalls(InitiateAuthCommand)[0]!.args[0].input,
    ).toMatchObject({
      AuthFlow: "USER_PASSWORD_AUTH",
    });
  });

  it("keeps the refresh token when a refresh doesn't rotate it", async () => {
    cognito.on(InitiateAuthCommand).resolves({
      AuthenticationResult: { AccessToken: await accessToken(), ExpiresIn: 60 },
    });

    const session = await client().refresh("refresh");

    expect(session.refreshToken).toBe("refresh");
  });

  it("treats a rejected refresh token as not authenticated", async () => {
    cognito
      .on(InitiateAuthCommand)
      .rejects(new NotAuthorizedException({ message: "x", $metadata: {} }));

    await expect(client().refresh("refresh")).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
  });

  it("rejects tokens for another client, of another use or issuer", async () => {
    for (const token of [
      await accessToken({ client_id: "other" }),
      await accessToken({ token_use: "id" }),
      await accessToken({ iss: "https://elsewhere.test" }),
      await accessToken({ exp: NOW_SECONDS - 1 }),
      "not-a-jwt",
    ]) {
      await expect(client().verifyAccessToken(token)).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
    }
  });

  it("turns Cognito's errors into the domain's", async () => {
    const meta = { message: "x", $metadata: {} };
    cognito.on(SignUpCommand).rejects(new UsernameExistsException(meta));
    cognito
      .on(InitiateAuthCommand)
      .rejectsOnce(new UserNotConfirmedException(meta))
      .rejectsOnce(new NotAuthorizedException(meta))
      .rejectsOnce(new InvalidPasswordException(meta));
    cognito.on(ConfirmSignUpCommand).rejects(new CodeMismatchException(meta));

    await expect(client().register("a", "b")).rejects.toBeInstanceOf(
      AccountExistsError,
    );
    await expect(client().signIn("a", "b")).rejects.toBeInstanceOf(
      AccountNotConfirmedError,
    );
    await expect(client().signIn("a", "b")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(client().signIn("a", "b")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(client().confirmRegistration("a", "1")).rejects.toBeInstanceOf(
      InvalidConfirmationCodeError,
    );
  });

  it("signs out by revoking the refresh token, even if already revoked", async () => {
    cognito
      .on(RevokeTokenCommand)
      .resolvesOnce({})
      .rejectsOnce(new NotAuthorizedException({ message: "x", $metadata: {} }));

    await client().signOut("refresh");
    await client().signOut("refresh");

    expect(cognito.commandCalls(RevokeTokenCommand)[0]!.args[0].input).toEqual({
      ClientId: "client",
      Token: "refresh",
    });
  });
});
