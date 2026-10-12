// Where services reach for user identities: accounts, their credentials and
// the tokens that prove who a caller is. Services never know which provider
// sits behind it.

export interface IdentitySession {
  // The provider's stable, opaque id for the identity.
  subject: string;
  accessToken: string;
  refreshToken: string;
  // When the access token expires, in epoch milliseconds.
  expiresAt: number;
}

export interface IdentityProvider {
  // Creates an unconfirmed account. The provider sends the owner a code.
  register(email: string, password: string): Promise<{ subject: string }>;
  confirmRegistration(email: string, code: string): Promise<void>;
  resendConfirmationCode(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<IdentitySession>;
  refresh(refreshToken: string): Promise<IdentitySession>;
  // Throws NotAuthenticatedError unless the token is valid and unexpired.
  verifyAccessToken(accessToken: string): Promise<{ subject: string }>;
  // Revokes a session's refresh token, so it can't mint access tokens any
  // more. Revoking an unknown or already revoked token does nothing.
  signOut(refreshToken: string): Promise<void>;
}
