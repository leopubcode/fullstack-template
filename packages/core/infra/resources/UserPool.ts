import type { RemovalPolicy } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface UserPoolProps {
  removalPolicy: RemovalPolicy;
}

// The identities CognitoIdentityProviderClient signs up and in: self sign-up
// by email, confirmed with an emailed code. The client is public (no secret);
// the API calls it on the browser's behalf with the password and refresh
// token flows.
export class UserPool extends Construct {
  readonly userPool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;
  // The tokens' issuer, which serves their JWKS.
  readonly issuerUrl: string;

  constructor(scope: Construct, id: string, props: UserPoolProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.removalPolicy,
    });

    this.client = this.userPool.addClient("Client", {
      generateSecret: false,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      // Signing out revokes the session's refresh token.
      enableTokenRevocation: true,
    });

    this.issuerUrl = this.userPool.userPoolProviderUrl;
  }
}
