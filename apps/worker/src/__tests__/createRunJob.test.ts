import { InvalidJobError } from "@repo/core";
import { describe, expect, it } from "vitest";
import { createRunJob } from "../createRunJob";

// Runs one job body the way Sidequest does, and returns the transition
// Sidequest would apply.
function perform(handle: (body: string) => Promise<void>, body = "{}") {
  const RunJob = createRunJob(handle);
  return new RunJob().perform(body);
}

describe("running a job on Sidequest", () => {
  it("hands the job's body to the handler", async () => {
    const handled: string[] = [];

    await perform(async (body) => {
      handled.push(body);
    }, '{"type":"Testing","foo":"bar"}');

    expect(handled).toEqual(['{"type":"Testing","foo":"bar"}']);
  });

  it("completes the job when the handler succeeds", async () => {
    const result = await perform(async () => {});

    expect(result).toMatchObject({ type: "completed" });
  });

  it("retries the job when the handler throws", async () => {
    const result = await perform(async () => {
      throw new Error("boom");
    });

    expect(result).toMatchObject({
      type: "retry",
      error: expect.objectContaining({ message: "boom" }),
    });
  });

  // Retrying can't fix a body that doesn't parse.
  it("fails the job at once when it is invalid", async () => {
    const result = await perform(async () => {
      throw new InvalidJobError("Invalid job");
    });

    expect(result).toMatchObject({
      type: "failed",
      error: expect.objectContaining({ message: "Invalid job" }),
    });
  });
});
