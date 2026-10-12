import { type Backend, DuplicatedJobError, type NewJobData } from "sidequest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidequestJobQueueClient } from "../SidequestJobQueueClient";

let createNewJob: ReturnType<typeof vi.fn<Backend["createNewJob"]>>;
let queue: SidequestJobQueueClient;

// The job data the client handed to the Sidequest backend.
function addedJob(): NewJobData {
  expect(createNewJob).toHaveBeenCalledTimes(1);
  return createNewJob.mock.calls[0][0];
}

beforeEach(() => {
  createNewJob = vi.fn<Backend["createNewJob"]>(
    async (job) => ({ ...job, id: 1 }) as never,
  );
  queue = new SidequestJobQueueClient({ createNewJob } as unknown as Backend);
});

describe("the Sidequest job queue", () => {
  it("adds the job's JSON body as a RunJob, for the worker's jobs file", async () => {
    await queue.add({ type: "Testing", foo: "bar" });

    expect(addedJob()).toMatchObject({
      script: "sidequest.jobs.js",
      class: "RunJob",
      queue: "default",
      args: ['{"type":"Testing","foo":"bar"}'],
      constructor_args: [],
      state: "waiting",
    });
    expect(addedJob().unique_digest).toBeUndefined();
  });

  it("makes the job available now without a runAt", async () => {
    const before = Date.now();

    await queue.add({ type: "Testing", foo: "bar" });

    expect(addedJob().available_at!.getTime()).toBeGreaterThanOrEqual(before);
    expect(addedJob().available_at!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("makes the job available at its runAt", async () => {
    const runAt = new Date("2026-01-09T00:00:00Z");

    await queue.add({ type: "Testing", foo: "bar" }, { runAt });

    expect(addedJob().available_at).toEqual(runAt);
  });

  it("makes a keyed job unique over its body and key", async () => {
    await queue.add({ type: "Testing", foo: "bar" }, { key: "k" });

    expect(addedJob()).toMatchObject({
      args: ['{"type":"Testing","foo":"bar"}', "k"],
      uniqueness_config: { type: "alive-job", withArgs: true },
      unique_digest: expect.any(String),
    });
  });

  it("treats a duplicate as already added", async () => {
    createNewJob.mockRejectedValue(new DuplicatedJobError({} as never));

    await expect(
      queue.add({ type: "Testing", foo: "bar" }, { key: "k" }),
    ).resolves.toBeUndefined();
  });

  it("lets any other error through", async () => {
    const error = new Error("connection refused");
    createNewJob.mockRejectedValue(error);

    await expect(queue.add({ type: "Testing", foo: "bar" })).rejects.toBe(
      error,
    );
  });
});
