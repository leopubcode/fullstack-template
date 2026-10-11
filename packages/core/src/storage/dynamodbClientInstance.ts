import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Configured by the SDK's standard environment (AWS_REGION, the credential
// chain, and AWS_ENDPOINT_URL to point at LocalStack locally), so the same
// client works locally, on a server and in Lambda, whose role credentials
// include a session token.
export const dynamodbClient = new DynamoDBClient({});

export const dynamodbDocumentClient =
  DynamoDBDocumentClient.from(dynamodbClient);
