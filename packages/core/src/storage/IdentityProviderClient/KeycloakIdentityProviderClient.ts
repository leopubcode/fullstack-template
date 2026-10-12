import { createRemoteJWKSet, jwtVerify } from "jose";
import type { KeycloakConfig } from "../../config";
import type { Clock } from "../../domain/clock";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidCredentialsError,
  InvalidPasswordError,
  NotAuthenticatedError,
} from "../../domain/identity/errors";
import type {
  IdentityProvider,
  IdentitySession,
} from "../../domain/identity/identityProvider";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  // Seconds.
  expires_in: number;
}

interface ErrorResponse {
  error?: string;
  error_description?: string;
}

// The admin token is fetched again this long before it expires, so it never
// lapses mid-request.
const ADMIN_TOKEN_MARGIN_MS = 30_000;

// Keycloak's answer to a correct password for an account with a required
// action left, which for accounts made by register is verifying the email.
const NOT_SET_UP = "Account is not fully set up";

// Talks to Keycloak over its HTTP APIs with plain fetch, so there's no SDK
// client to inject. Users sign in with the OAuth password grant; accounts are
// created and emailed through the Admin REST API, as the client's service
// account (client credentials grant).
export class KeycloakIdentityProviderClient implements IdentityProvider {
  private readonly realmUrl: string;
  private readonly adminUrl: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private adminToken?: { value: string; expiresAt: number };

  constructor(
    private readonly config: KeycloakConfig,
    private readonly clock: Clock,
  ) {
    this.realmUrl = `${config.url}/realms/${config.realm}`;
    this.adminUrl = `${config.url}/admin/realms/${config.realm}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.realmUrl}/protocol/openid-connect/certs`),
    );
  }

  async register(email: string, password: string) {
    const response = await this.admin("POST", "/users", {
      username: email,
      email,
      enabled: true,
      emailVerified: false,
      credentials: [{ type: "password", value: password, temporary: false }],
    });
    if (response.status === 409) {
      throw new AccountExistsError();
    }
    if (response.status === 400) {
      const body = await errorBody(response);
      // e.g. invalidPasswordMinLengthMessage. Keycloak creates no user then.
      if (body.error?.startsWith("invalidPassword")) {
        throw new InvalidPasswordError(body.error_description);
      }
      throw keycloakError("POST /users", response, body);
    }
    await expectOk("POST /users", response);
    // Answered with Location: <admin url>/users/<id>.
    const subject = response.headers.get("location")!.split("/").pop()!;
    // The account exists from here on, so a failed email mustn't fail the
    // registration: the owner can ask for another link.
    await this.sendVerificationEmail(subject).catch((error: unknown) => {
      console.error("Couldn't send the verification email", error);
    });
    return { subject };
  }

  async resendVerification(email: string) {
    const query = new URLSearchParams({ email, exact: "true" });
    const response = await this.admin("GET", `/users?${query}`);
    await expectOk("GET /users", response);
    const [user] = (await response.json()) as {
      id: string;
      emailVerified?: boolean;
    }[];
    if (user && !user.emailVerified) {
      await this.sendVerificationEmail(user.id);
    }
  }

  async signIn(email: string, password: string) {
    const response = await this.token({
      grant_type: "password",
      username: email,
      password,
    });
    if (!response.ok) {
      const body = await errorBody(response);
      if (body.error === "invalid_grant") {
        throw body.error_description === NOT_SET_UP
          ? new AccountNotConfirmedError()
          : new InvalidCredentialsError();
      }
      throw keycloakError("password grant", response, body);
    }
    return this.toSession((await response.json()) as TokenResponse);
  }

  async refresh(refreshToken: string) {
    const response = await this.token({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (!response.ok) {
      const body = await errorBody(response);
      if (body.error === "invalid_grant") {
        // Expired, ended by signOut, or never valid.
        throw new NotAuthenticatedError();
      }
      throw keycloakError("refresh grant", response, body);
    }
    return this.toSession((await response.json()) as TokenResponse);
  }

  async verifyAccessToken(accessToken: string) {
    const { subject } = await this.verify(accessToken);
    return { subject };
  }

  async signOut(refreshToken: string) {
    const response = await fetch(
      `${this.realmUrl}/protocol/openid-connect/logout`,
      {
        method: "POST",
        body: this.clientParams({ refresh_token: refreshToken }),
      },
    );
    if (!response.ok) {
      const body = await errorBody(response);
      // Already ended, or never valid: either way, signed out.
      if (body.error !== "invalid_grant") {
        throw keycloakError("logout", response, body);
      }
    }
  }

  private async toSession(tokens: TokenResponse): Promise<IdentitySession> {
    const { subject, expiresAt } = await this.verify(tokens.access_token);
    return {
      subject,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };
  }

  // Checks the token's signature against the realm's JWKS, and that it's an
  // unexpired access token issued to our client.
  private async verify(
    accessToken: string,
  ): Promise<{ subject: string; expiresAt: number }> {
    try {
      const { payload } = await jwtVerify(accessToken, this.jwks, {
        issuer: this.realmUrl,
        currentDate: this.clock.now(),
        requiredClaims: ["sub", "exp"],
      });
      if (payload.typ === "Bearer" && payload.azp === this.config.clientId) {
        return { subject: payload.sub!, expiresAt: payload.exp! * 1000 };
      }
    } catch {
      // Falls through: any failure means the caller isn't authenticated.
    }
    throw new NotAuthenticatedError();
  }

  private sendVerificationEmail(userId: string): Promise<void> {
    const query = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.verifyEmailRedirectUri,
    });
    const path = `/users/${userId}/send-verify-email`;
    return this.admin("PUT", `${path}?${query}`).then((response) =>
      expectOk(`PUT ${path}`, response),
    );
  }

  private token(params: Record<string, string>): Promise<Response> {
    return fetch(`${this.realmUrl}/protocol/openid-connect/token`, {
      method: "POST",
      body: this.clientParams(params),
    });
  }

  private clientParams(params: Record<string, string>): URLSearchParams {
    return new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...params,
    });
  }

  private async admin(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    return fetch(`${this.adminUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.adminAccessToken()}`,
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  // The service account's token, reused until shortly before it expires.
  private async adminAccessToken(): Promise<string> {
    const now = this.clock.now().getTime();
    if (!this.adminToken || this.adminToken.expiresAt <= now) {
      const response = await this.token({ grant_type: "client_credentials" });
      await expectOk("client credentials grant", response);
      const tokens = (await response.json()) as TokenResponse;
      this.adminToken = {
        value: tokens.access_token,
        expiresAt: now + tokens.expires_in * 1000 - ADMIN_TOKEN_MARGIN_MS,
      };
    }
    return this.adminToken.value;
  }
}

async function errorBody(response: Response): Promise<ErrorResponse> {
  return (await response.json().catch(() => ({}))) as ErrorResponse;
}

async function expectOk(request: string, response: Response): Promise<void> {
  if (!response.ok) {
    throw keycloakError(request, response, await errorBody(response));
  }
}

function keycloakError(
  request: string,
  response: Response,
  body: ErrorResponse,
): Error {
  return new Error(
    `Keycloak ${request} answered ${response.status}: ${JSON.stringify(body)}`,
  );
}
