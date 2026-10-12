import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

// Configured by the SDK's standard environment (AWS_REGION, AWS_ENDPOINT_URL, …).
// Locally, AWS_ENDPOINT_URL_COGNITO_IDENTITY_PROVIDER points it at
// cognito-local while the other clients keep using LocalStack.
export const cognitoClient = new CognitoIdentityProviderClient({});
