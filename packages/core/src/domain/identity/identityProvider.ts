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
  // Creates an account whose email isn't verified yet. The provider emails
  // the owner a link to verify it; until they follow it, signIn throws
  // AccountNotConfirmedError.
  register(email: string, password: string): Promise<{ subject: string }>;
  // Emails a new verification link if the email belongs to an unverified
  // account, and does nothing otherwise, so it can't reveal who has one.
  resendVerification(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<IdentitySession>;
  refresh(refreshToken: string): Promise<IdentitySession>;
  // Throws NotAuthenticatedError unless the token is valid and unexpired.
  verifyAccessToken(accessToken: string): Promise<{ subject: string }>;
  // Ends a session, so its refresh token can't mint access tokens any more.
  // Ending an unknown or already ended session does nothing.
  signOut(refreshToken: string): Promise<void>;
}
