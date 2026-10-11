import { describe, expect, it } from "vitest";
import { createInMemoryStorage } from "../../storage/createInMemoryStorage";
import { TestService } from "../TestService";

describe("submitting a test job", () => {
  it("queues a Testing job to run a day from now on the clock", async () => {
    let now = new Date("2026-01-08T00:00:00Z");
    const clock = { now: () => now };
    const { jobQueue } = createInMemoryStorage(clock);
    const ran: string[] = [];
    const runDueJobs = () =>
      jobQueue.runDueJobs(async (body) => {
        ran.push(body);
      });

    await new TestService(jobQueue, clock).submit();

    now = new Date("2026-01-08T23:59:59Z");
    await runDueJobs();
    expect(ran).toEqual([]);

    now = new Date("2026-01-09T00:00:00Z");
    await runDueJobs();
    expect(ran).toEqual(['{"type":"Testing","foo":"aaa"}']);
  });
});
