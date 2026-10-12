import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "../../../domain/users/types";
import { DynamoUsersRepository } from "../DynamoUsersRepository";

const dynamo = mockClient(DynamoDBDocumentClient);

const repository = () =>
  new DynamoUsersRepository(
    "Users",
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );

const user = (id: string): User => ({
  id,
  email: `${id}@example.com`,
  displayName: `User ${id}`,
  roles: ["Customer"],
});

beforeEach(() => {
  dynamo.reset();
});

describe("the DynamoDB users repository", () => {
  it("puts a created user in the table", async () => {
    await repository().create(user("u-1"));

    expect(dynamo.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: "Users",
      Item: user("u-1"),
    });
  });

  it("gets a user by id with a consistent read", async () => {
    dynamo
      .on(GetCommand, {
        TableName: "Users",
        Key: { id: "u-1" },
        ConsistentRead: true,
      })
      .resolves({ Item: user("u-1") });

    expect(await repository().getById("u-1")).toEqual(user("u-1"));
  });

  it("returns undefined for an id that isn't there", async () => {
    dynamo.on(GetCommand).resolves({});

    expect(await repository().getById("missing")).toBeUndefined();
  });

  it("lists users across every page of the scan", async () => {
    dynamo
      .on(ScanCommand, { TableName: "Users", ExclusiveStartKey: undefined })
      .resolves({ Items: [user("u-1")], LastEvaluatedKey: { id: "u-1" } })
      .on(ScanCommand, { TableName: "Users", ExclusiveStartKey: { id: "u-1" } })
      .resolves({ Items: [user("u-2")] });

    expect(await repository().list()).toEqual([user("u-1"), user("u-2")]);
    expect(dynamo.commandCalls(ScanCommand)).toHaveLength(2);
  });
});
