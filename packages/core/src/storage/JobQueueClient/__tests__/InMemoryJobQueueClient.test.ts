import { beforeEach, describe, expect, it } from "vitest";
import type { Job } from "../../../domain/jobs/types";
import { InMemoryJobQueueClient } from "../InMemoryJobQueueClient";

let now: Date;
let queue: InMemoryJobQueueClient;

const job = (foo: string): Job => ({ type: "Testing", foo });

const later = (ms: number) => new Date(now.getTime() + ms);

// The foo of every job run by this call, in order.
async function runDueJobs(): Promise<string[]> {
  const ran: string[] = [];
  await queue.runDueJobs(async (body) => {
    ran.push((JSON.parse(body) as Job).foo);
  });
  return ran;
}

beforeEach(() => {
  now = new Date("2026-01-08T00:00:00Z");
  queue = new InMemoryJobQueueClient({ now: () => now });
});

describe("the in-memory job queue", () => {
  it("runs a job without a runAt on the next run", async () => {
    await queue.add(job("a"));

    expect(await runDueJobs()).toEqual(["a"]);
  });

  it("runs each job only once", async () => {
    await queue.add(job("a"));

    await runDueJobs();

    expect(await runDueJobs()).toEqual([]);
  });

  it("holds a job until its runAt has passed on the clock", async () => {
    await queue.add(job("a"), { runAt: later(60_000) });

    expect(await runDueJobs()).toEqual([]);

    now = later(60_000);
    expect(await runDueJobs()).toEqual(["a"]);
  });

  it("adds nothing for a key already waiting to run", async () => {
    await queue.add(job("a"), { runAt: later(60_000), key: "k" });
    await queue.add(job("b"), { runAt: later(60_000), key: "k" });

    now = later(60_000);
    expect(await runDueJobs()).toEqual(["a"]);
  });

  it("accepts a key again once its job has run", async () => {
    await queue.add(job("a"), { runAt: later(60_000), key: "k" });
    now = later(60_000);
    await runDueJobs();

    await queue.add(job("b"), { runAt: later(60_000), key: "k" });

    now = later(60_000);
    expect(await runDueJobs()).toEqual(["b"]);
  });

  it("ignores the key of a job that is already due", async () => {
    await queue.add(job("a"), { key: "k" });
    await queue.add(job("b"), { key: "k" });

    expect(await runDueJobs()).toEqual(["a", "b"]);
  });
});
