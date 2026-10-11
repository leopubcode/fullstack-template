import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { loadTablesConfig } from "../config";
import { dynamodbClient } from "./dynamodbClientInstance";

async function ensureTable(tableName: string): Promise<void> {
  try {
    await dynamodbClient.send(
      new DescribeTableCommand({ TableName: tableName }),
    );
    return;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }
  }

  await dynamodbClient.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );

  await waitUntilTableExists(
    { client: dynamodbClient, maxWaitTime: 30 },
    { TableName: tableName },
  );
}

async function main(): Promise<void> {
  const tables = loadTablesConfig(process.env);

  await ensureTable(tables.users);

  console.log(`db:setup complete (tables: ${tables.users})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
