import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import {
  afterEach,
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
  InvalidCredentialsError,
  InvalidPasswordError,
  NotAuthenticatedError,
} from "../../../domain/identity/errors";
import { KeycloakIdentityProviderClient } from "../KeycloakIdentityProviderClient";

const config = {
  url: "https://keycloak.test",
  realm: "app",
  clientId: "api",
  clientSecret: "secret",
  verifyEmailRedirectUri: "https://web.test/signin",
};
const REALM = "https://keycloak.test/realms/app";
const ADMIN = "https://keycloak.test/admin/realms/app";
const NOW = new Date("2026-01-01T00:00:00Z");
const NOW_SECONDS = NOW.getTime() / 1000;
const clock = { now: () => NOW };

let privateKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
});

interface Call {
  method: string;
  url: string;
  form?: Record<string, string>;
  json?: unknown;
  authorization?: string;
}

// Stands in for Keycloak: each test routes "<METHOD> <url without query>"
// to a response. The JWKS and the service account's token are always served.
let routes: Record<string, () => Response>;
let calls: Call[];

beforeEach(() => {
  calls = [];
  routes = {
    [`GET ${REALM}/protocol/openid-connect/certs`]: () =>
      Response.json({ keys: [jwk] }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body;
      const form =
        body instanceof URLSearchParams ? Object.fromEntries(body) : undefined;
      calls.push({
        method,
        url,
        form,
        json: typeof body === "string" ? JSON.parse(body) : undefined,
        authorization:
          new Headers(init?.headers).get("authorization") ?? undefined,
      });
      if (form?.grant_type === "client_credentials") {
        return Response.json({ access_token: "admin-token", expires_in: 300 });
      }
      const route = routes[`${method} ${url.split("?")[0]}`];
      if (!route) {
        throw new Error(`Unexpected ${method} ${url}`);
      }
      return route();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const client = () => new KeycloakIdentityProviderClient(config, clock);

function accessToken(claims: Record<string, unknown> = {}) {
  return new SignJWT({
    typ: "Bearer",
    azp: "api",
    sub: "sub-1",
    iss: REALM,
    iat: NOW_SECONDS,
    exp: NOW_SECONDS + 300,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .sign(privateKey);
}

const tokenRoute = (response: () => Response | Promise<Response>) => {
  routes[`POST ${REALM}/protocol/openid-connect/token`] =
    response as () => Response;
};

const oauthError = (status: number, error: string, description?: string) =>
  Response.json({ error, error_description: description }, { status });

describe("the Keycloak identity provider client", () => {
  describe("register", () => {
    it("creates the user as the service account and emails a verification link", async () => {
      routes[`POST ${ADMIN}/users`] = () =>
        new Response(null, {
          status: 201,
          headers: { location: `${ADMIN}/users/sub-1` },
        });
      routes[`PUT ${ADMIN}/users/sub-1/send-verify-email`] = () =>
        new Response(null, { status: 204 });

      const result = await client().register("ada@example.com", "pw-123456");

      expect(result).toEqual({ subject: "sub-1" });
      const create = calls.find((call) => call.url === `${ADMIN}/users`)!;
      expect(create.authorization).toBe("Bearer admin-token");
      expect(create.json).toMatchObject({
        username: "ada@example.com",
        email: "ada@example.com",
        emailVerified: false,
        credentials: [{ type: "password", value: "pw-123456" }],
      });
      const send = calls.find((call) =>
        call.url.includes("send-verify-email"),
      )!;
      expect(new URL(send.url).searchParams.get("redirect_uri")).toBe(
        "https://web.test/signin",
      );
    });

    it("still registers when the email can't be sent", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      routes[`POST ${ADMIN}/users`] = () =>
        new Response(null, {
          status: 201,
          headers: { location: `${ADMIN}/users/sub-1` },
        });
      routes[`PUT ${ADMIN}/users/sub-1/send-verify-email`] = () =>
        Response.json({ errorMessage: "Failed to send" }, { status: 500 });

      await expect(
        client().register("ada@example.com", "pw-123456"),
      ).resolves.toEqual({ subject: "sub-1" });
    });

    it("maps a taken email and a weak password to domain errors", async () => {
      routes[`POST ${ADMIN}/users`] = () =>
        Response.json(
          { errorMessage: "User exists with same email" },
          { status: 409 },
        );
      await expect(
        client().register("ada@example.com", "pw-123456"),
      ).rejects.toBeInstanceOf(AccountExistsError);

      routes[`POST ${ADMIN}/users`] = () =>
        oauthError(400, "invalidPasswordMinLengthMessage", "Too short");
      await expect(
        client().register("ada@example.com", "short"),
      ).rejects.toBeInstanceOf(InvalidPasswordError);
    });

    it("reuses the service account's token until it nearly expires", async () => {
      routes[`GET ${ADMIN}/users`] = () => Response.json([]);
      const keycloak = client();

      await keycloak.resendVerification("a@example.com");
      await keycloak.resendVerification("b@example.com");

      const grants = calls.filter(
        (call) => call.form?.grant_type === "client_credentials",
      );
      expect(grants).toHaveLength(1);
    });
  });

  describe("resendVerification", () => {
    it("emails an unverified account, and nobody else", async () => {
      routes[`PUT ${ADMIN}/users/sub-1/send-verify-email`] = () =>
        new Response(null, { status: 204 });
      const sends = () =>
        calls.filter((call) => call.url.includes("send-verify-email"));

      routes[`GET ${ADMIN}/users`] = () =>
        Response.json([{ id: "sub-1", emailVerified: false }]);
      await client().resendVerification("ada@example.com");
      expect(sends()).toHaveLength(1);

      routes[`GET ${ADMIN}/users`] = () =>
        Response.json([{ id: "sub-1", emailVerified: true }]);
      await client().resendVerification("ada@example.com");
      routes[`GET ${ADMIN}/users`] = () => Response.json([]);
      await client().resendVerification("nobody@example.com");
      expect(sends()).toHaveLength(1);
    });
  });

  describe("signIn", () => {
    it("returns the session, with the subject and expiry from the access token", async () => {
      const token = await accessToken();
      tokenRoute(() =>
        Response.json({
          access_token: token,
          refresh_token: "refresh-1",
          expires_in: 300,
        }),
      );

      const session = await client().signIn("ada@example.com", "pw-123456");

      expect(session).toEqual({
        subject: "sub-1",
        accessToken: token,
        refreshToken: "refresh-1",
        expiresAt: (NOW_SECONDS + 300) * 1000,
      });
      const grant = calls.find((call) => call.form?.grant_type === "password")!;
      expect(grant.form).toMatchObject({
        client_id: "api",
        client_secret: "secret",
        username: "ada@example.com",
        password: "pw-123456",
      });
    });

    it("tells an unverified account from wrong credentials", async () => {
      tokenRoute(() =>
        oauthError(400, "invalid_grant", "Account is not fully set up"),
      );
      await expect(
        client().signIn("a@example.com", "x"),
      ).rejects.toBeInstanceOf(AccountNotConfirmedError);

      tokenRoute(() =>
        oauthError(401, "invalid_grant", "Invalid user credentials"),
      );
      await expect(
        client().signIn("a@example.com", "x"),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  describe("refresh", () => {
    it("answers a rejected refresh token as not authenticated", async () => {
      tokenRoute(() => oauthError(400, "invalid_grant", "Session not active"));

      await expect(client().refresh("refresh-1")).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
    });
  });

  describe("verifyAccessToken", () => {
    it("accepts an unexpired access token issued to the client", async () => {
      await expect(
        client().verifyAccessToken(await accessToken()),
      ).resolves.toEqual({ subject: "sub-1" });
    });

    it.each([
      ["expired", { exp: NOW_SECONDS - 1 }],
      ["from another realm", { iss: "https://keycloak.test/realms/other" }],
      ["issued to another client", { azp: "other" }],
      ["not an access token", { typ: "Refresh" }],
    ])("rejects a token %s", async (_, claims) => {
      await expect(
        client().verifyAccessToken(await accessToken(claims)),
      ).rejects.toBeInstanceOf(NotAuthenticatedError);
    });

    it("rejects a token that isn't a JWT", async () => {
      await expect(client().verifyAccessToken("forged")).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
    });
  });

  describe("signOut", () => {
    it("ends the session, and treats an already ended one as signed out", async () => {
      const logout = `POST ${REALM}/protocol/openid-connect/logout`;
      routes[logout] = () => new Response(null, { status: 204 });
      await client().signOut("refresh-1");
      expect(calls.at(-1)!.form).toMatchObject({ refresh_token: "refresh-1" });

      routes[logout] = () =>
        oauthError(400, "invalid_grant", "Invalid refresh token");
      await expect(client().signOut("refresh-1")).resolves.toBeUndefined();
    });
  });
});
