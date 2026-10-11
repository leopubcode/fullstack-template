import type { SQSEvent, SQSRecord } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handleSqsEvent } from "../handleSqsEvent";

const record = (messageId: string, body: string): SQSRecord =>
  ({ messageId, body }) as SQSRecord;

const event = (...records: SQSRecord[]): SQSEvent => ({ Records: records });

describe("handling a batch of SQS records", () => {
  it("hands every record's body to the job handler", async () => {
    const handled: string[] = [];

    await handleSqsEvent(event(record("m-1", "a"), record("m-2", "b")), {
      handle: async (body) => {
        handled.push(body);
      },
    });

    expect(handled).toEqual(["a", "b"]);
  });

  it("reports no failures when every record is handled", async () => {
    const response = await handleSqsEvent(event(record("m-1", "a")), {
      handle: async () => {},
    });

    expect(response).toEqual({ batchItemFailures: [] });
  });

  // SQS then redelivers only the failed records, not the whole batch.
  it("reports only the records whose handling threw", async () => {
    const response = await handleSqsEvent(
      event(record("m-1", "ok"), record("m-2", "bad"), record("m-3", "ok")),
      {
        handle: async (body) => {
          if (body === "bad") throw new Error("boom");
        },
        logError: () => {},
      },
    );

    expect(response).toEqual({
      batchItemFailures: [{ itemIdentifier: "m-2" }],
    });
  });

  it("logs each failure with its message id", async () => {
    const logged: unknown[][] = [];
    const error = new Error("boom");

    await handleSqsEvent(event(record("m-1", "bad")), {
      handle: async () => {
        throw error;
      },
      logError: (...args) => {
        logged.push(args);
      },
    });

    expect(logged).toEqual([["Job in message m-1 failed", error]]);
  });
});
