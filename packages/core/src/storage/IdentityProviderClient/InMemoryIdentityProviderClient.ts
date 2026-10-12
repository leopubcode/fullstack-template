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

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

interface Account {
  subject: string;
  password: string;
  confirmed: boolean;
  code: string;
}

// Test double for the identity provider. Tokens are opaque random strings,
// and the confirmation code it would have emailed is readable via codeFor.
export class InMemoryIdentityProviderClient implements IdentityProvider {
  private readonly accountsByEmail = new Map<string, Account>();
  private readonly accessTokens = new Map<
    string,
    { subject: string; expiresAt: number }
  >();
  private readonly refreshTokens = new Map<string, string>();

  constructor(private readonly clock: Clock) {}

  codeFor(email: string): string | undefined {
    return this.accountsByEmail.get(email)?.code;
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
      confirmed: false,
      code: newCode(),
    };
    this.accountsByEmail.set(email, account);
    return { subject: account.subject };
  }

  async confirmRegistration(email: string, code: string) {
    const account = this.accountsByEmail.get(email);
    if (!account || account.code !== code) {
      throw new InvalidConfirmationCodeError();
    }
    account.confirmed = true;
  }

  async resendConfirmationCode(email: string) {
    const account = this.accountsByEmail.get(email);
    if (account && !account.confirmed) {
      account.code = newCode();
    }
  }

  async signIn(email: string, password: string) {
    const account = this.accountsByEmail.get(email);
    if (!account || account.password !== password) {
      throw new InvalidCredentialsError();
    }
    if (!account.confirmed) {
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

function newCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
