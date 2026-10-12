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

const ACCESS_TOKEN_TTL_MS = 5 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

interface Account {
  subject: string;
  password: string;
  verified: boolean;
  // How many verification emails it would have been sent.
  emailsSent: number;
}

// Test double for the identity provider. Tokens are opaque random strings.
// Following an emailed verification link is verifyEmail.
export class InMemoryIdentityProviderClient implements IdentityProvider {
  private readonly accountsByEmail = new Map<string, Account>();
  private readonly accessTokens = new Map<
    string,
    { subject: string; expiresAt: number }
  >();
  private readonly refreshTokens = new Map<string, string>();

  constructor(private readonly clock: Clock) {}

  verifyEmail(email: string): void {
    const account = this.accountsByEmail.get(email);
    if (account) {
      account.verified = true;
    }
  }

  verificationEmailsSentTo(email: string): number {
    return this.accountsByEmail.get(email)?.emailsSent ?? 0;
  }

  async register(email: string, password: string) {
    if (this.accountsByEmail.has(email)) {
      throw new AccountExistsError();
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidPasswordError();
    }
    const account: Account = {
      subject: crypto.randomUUID(),
      password,
      verified: false,
      emailsSent: 1,
    };
    this.accountsByEmail.set(email, account);
    return { subject: account.subject };
  }

  async resendVerification(email: string) {
    const account = this.accountsByEmail.get(email);
    if (account && !account.verified) {
      account.emailsSent += 1;
    }
  }

  async signIn(email: string, password: string) {
    const account = this.accountsByEmail.get(email);
    if (!account || account.password !== password) {
      throw new InvalidCredentialsError();
    }
    if (!account.verified) {
      throw new AccountNotConfirmedError();
    }
    const refreshToken = crypto.randomUUID();
    this.refreshTokens.set(refreshToken, account.subject);
    return this.issue(account.subject, refreshToken);
  }

  async refresh(refreshToken: string) {
    const subject = this.refreshTokens.get(refreshToken);
    if (!subject) {
      throw new NotAuthenticatedError();
    }
    return this.issue(subject, refreshToken);
  }

  async verifyAccessToken(accessToken: string) {
    const token = this.accessTokens.get(accessToken);
    if (!token || token.expiresAt <= this.clock.now().getTime()) {
      throw new NotAuthenticatedError();
    }
    return { subject: token.subject };
  }

  async signOut(refreshToken: string) {
    this.refreshTokens.delete(refreshToken);
  }

  private issue(subject: string, refreshToken: string): IdentitySession {
    const accessToken = crypto.randomUUID();
    const expiresAt = this.clock.now().getTime() + ACCESS_TOKEN_TTL_MS;
    this.accessTokens.set(accessToken, { subject, expiresAt });
    return { subject, accessToken, refreshToken, expiresAt };
  }
}
