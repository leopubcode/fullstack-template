import { NotAuthenticatedError } from "../domain/identity/errors";
import type {
  IdentityProvider,
  IdentitySession,
} from "../domain/identity/identityProvider";
import type { User } from "../domain/users/types";
import type { UsersService } from "./UsersService";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  // When the access token expires, in epoch milliseconds.
  expiresAt: number;
  user: User;
}

export interface SignUpResult {
  email: string;
  nextStep: "VERIFY_EMAIL";
}

// Signing up, in and out. Identities live with the identity provider; the
// user each one belongs to is reached only through the users service.
export class AuthService {
  constructor(
    private readonly identity: IdentityProvider,
    private readonly users: UsersService,
  ) {}

  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<SignUpResult> {
    const { subject } = await this.identity.register(
      input.email,
      input.password,
    );
    await this.users.createCustomer({
      id: subject,
      email: input.email,
      displayName: input.displayName,
    });
    return { email: input.email, nextStep: "VERIFY_EMAIL" };
  }

  resendVerification(input: { email: string }): Promise<void> {
    return this.identity.resendVerification(input.email);
  }

  async signIn(input: {
    email: string;
    password: string;
  }): Promise<AuthSession> {
    return this.toAuthSession(
      await this.identity.signIn(input.email, input.password),
    );
  }

  async refresh(input: { refreshToken: string }): Promise<AuthSession> {
    return this.toAuthSession(await this.identity.refresh(input.refreshToken));
  }

  // The user an access token proves the caller to be.
  async authenticate(accessToken: string | undefined): Promise<User> {
    if (!accessToken) {
      throw new NotAuthenticatedError();
    }
    const { subject } = await this.identity.verifyAccessToken(accessToken);
    return this.userFor(subject);
  }

  signOut(input: { refreshToken: string }): Promise<void> {
    return this.identity.signOut(input.refreshToken);
  }

  private async toAuthSession(session: IdentitySession): Promise<AuthSession> {
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      user: await this.userFor(session.subject),
    };
  }

  private async userFor(subject: string): Promise<User> {
    const user = await this.users.getById(subject);
    if (!user) {
      throw new NotAuthenticatedError();
    }
    return user;
  }
}
