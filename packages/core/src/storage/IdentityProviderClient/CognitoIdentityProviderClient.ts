import {
  type AuthenticationResultType,
  type CognitoIdentityProviderClient as CognitoSdkClient,
  CodeMismatchException,
  ConfirmSignUpCommand,
  ExpiredCodeException,
  InitiateAuthCommand,
  InvalidPasswordException,
  NotAuthorizedException,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  UserNotConfirmedException,
  UserNotFoundException,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { CognitoConfig } from "../../config";
import type { Clock } from "../../domain/clock";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidConfirmationCodeError,
  InvalidCredentialsError,
  InvalidPasswordError,
  NotAuthenticatedError,
} from "../../domain/identity/errors";
import type {
  IdentityProvider,
  IdentitySession,
} from "../../domain/identity/identityProvider";

export class CognitoIdentityProviderClient implements IdentityProvider {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: CognitoConfig,
    private readonly clock: Clock,
    private readonly client: CognitoSdkClient,
  ) {
    this.jwks = createRemoteJWKSet(
      new URL(`${config.issuerUrl}/.well-known/jwks.json`),
    );
  }

  async register(email: string, password: string) {
    const result = await this.call(() =>
      this.client.send(
        new SignUpCommand({
          ClientId: this.config.clientId,
          Username: email,
          Password: password,
          UserAttributes: [{ Name: "email", Value: email }],
        }),
      ),
    );
    return { subject: result.UserSub! };
  }

  async confirmRegistration(email: string, code: string) {
    await this.call(() =>
      this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.config.clientId,
          Username: email,
          ConfirmationCode: code,
        }),
      ),
    );
  }

  async resendConfirmationCode(email: string) {
    await this.call(() =>
      this.client.send(
        new ResendConfirmationCodeCommand({
          ClientId: this.config.clientId,
          Username: email,
        }),
      ),
    );
  }

  async signIn(email: string, password: string) {
    const result = await this.call(() =>
      this.client.send(
        new InitiateAuthCommand({
          ClientId: this.config.clientId,
          AuthFlow: "USER_PASSWORD_AUTH",
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      ),
    ).catch((error: unknown) => {
      // Some emulators reject a wrong password as a policy violation.
      throw error instanceof InvalidPasswordError
        ? new InvalidCredentialsError()
        : error;
    });
    return this.toSession(result.AuthenticationResult);
  }

  async refresh(refreshToken: string) {
    const result = await this.call(() =>
      this.client.send(
        new InitiateAuthCommand({
          ClientId: this.config.clientId,
          AuthFlow: "REFRESH_TOKEN_AUTH",
          AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
      ),
    ).catch((error: unknown) => {
      throw error instanceof InvalidCredentialsError
        ? new NotAuthenticatedError()
        : error;
    });
    // Cognito only returns a new refresh token when rotation is on.
    return this.toSession(result.AuthenticationResult, refreshToken);
  }

  async verifyAccessToken(accessToken: string) {
    const { subject } = await this.verify(accessToken);
    return { subject };
  }

  async signOut(refreshToken: string) {
    await this.call(() =>
      this.client.send(
        new RevokeTokenCommand({
          ClientId: this.config.clientId,
          Token: refreshToken,
        }),
      ),
    ).catch((error: unknown) => {
      // Already revoked, or never valid: either way, signed out.
      if (!(error instanceof InvalidCredentialsError)) {
        throw error;
      }
    });
  }

  private async toSession(
    result: AuthenticationResultType | undefined,
    previousRefreshToken?: string,
  ): Promise<IdentitySession> {
    const accessToken = result?.AccessToken;
    const refreshToken = result?.RefreshToken ?? previousRefreshToken;
    if (!accessToken || !refreshToken) {
      // A challenge (e.g. NEW_PASSWORD_REQUIRED) instead of tokens. Accounts
      // created through self sign-up never get one.
      throw new InvalidCredentialsError();
    }
    const { subject, expiresAt } = await this.verify(accessToken);
    return { subject, accessToken, refreshToken, expiresAt };
  }

  // Checks the token's signature against the issuer's JWKS, and that it's an
  // unexpired access token for our client.
  private async verify(
    accessToken: string,
  ): Promise<{ subject: string; expiresAt: number }> {
    try {
      const { payload } = await jwtVerify(accessToken, this.jwks, {
        issuer: this.config.issuerUrl,
        currentDate: this.clock.now(),
        requiredClaims: ["sub", "exp"],
      });
      if (
        payload.token_use === "access" &&
        payload.client_id === this.config.clientId
      ) {
        return { subject: payload.sub!, expiresAt: payload.exp! * 1000 };
      }
    } catch {
      // Falls through: any failure means the caller isn't authenticated.
    }
    throw new NotAuthenticatedError();
  }

  // Runs a Cognito call, turning its errors into the domain's.
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw toDomainError(error);
    }
  }
}

function toDomainError(error: unknown): unknown {
  if (
    error instanceof NotAuthorizedException ||
    error instanceof UserNotFoundException
  ) {
    return new InvalidCredentialsError();
  }
  if (error instanceof UsernameExistsException) {
    return new AccountExistsError();
  }
  if (error instanceof UserNotConfirmedException) {
    return new AccountNotConfirmedError();
  }
  if (
    error instanceof CodeMismatchException ||
    error instanceof ExpiredCodeException
  ) {
    return new InvalidConfirmationCodeError();
  }
  if (error instanceof InvalidPasswordException) {
    return new InvalidPasswordError(error.message);
  }
  return error;
}
