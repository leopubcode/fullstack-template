import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { UsersRepository } from "../../domain/users/repository";
import type { User } from "../../domain/users/types";

export class DynamoUsersRepository implements UsersRepository {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient,
  ) {}

  async create(user: User): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: user }),
    );
  }

  async getById(id: string): Promise<User | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id },
        ConsistentRead: true,
      }),
    );
    return result.Item as User | undefined;
  }

  async list(): Promise<User[]> {
    const users: User[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      users.push(...((result.Items ?? []) as User[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey !== undefined);

    return users;
  }
}
