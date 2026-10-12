// Provider-neutral failures. Each IdentityProvider maps its own errors to
// these, so services and transports never see a provider's error types.

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Incorrect email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountExistsError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "AccountExistsError";
  }
}

export class AccountNotConfirmedError extends Error {
  constructor() {
    super("The account's email has not been confirmed");
    this.name = "AccountNotConfirmedError";
  }
}

export class InvalidConfirmationCodeError extends Error {
  constructor() {
    super("The confirmation code is invalid or has expired");
    this.name = "InvalidConfirmationCodeError";
  }
}

export class InvalidPasswordError extends Error {
  constructor(message = "The password does not meet the password policy") {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}
