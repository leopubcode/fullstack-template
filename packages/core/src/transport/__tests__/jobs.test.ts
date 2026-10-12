import { describe, expect, it, vi } from "vitest";
import { createServices } from "../../services/createServices";
import { createInMemoryStorage } from "../../storage/createInMemoryStorage";
import { handleJob, InvalidJobError, type JobContext } from "../jobs";

const clock = { now: () => new Date() };

const context: JobContext = {
  services: createServices(createInMemoryStorage(clock), clock),
};

describe("handling a job body", () => {
  it("hands the parsed job and context to the handler for its type", async () => {
    const Testing = vi.fn(async () => {});

    await handleJob('{"type":"Testing","foo":"bar"}', context, { Testing });

    expect(Testing).toHaveBeenCalledWith(
      { type: "Testing", foo: "bar" },
      context,
    );
  });

  it("runs a Testing job through the test service by default", async () => {
    const doTestWork = vi
      .spyOn(context.services.test, "doTestWork")
      .mockResolvedValue();

    await handleJob('{"type":"Testing","foo":"bar"}', context);

    expect(doTestWork).toHaveBeenCalledWith("bar");
  });

  it("rejects a body that isn't JSON", async () => {
    await expect(handleJob("not json", context)).rejects.toBeInstanceOf(
      InvalidJobError,
    );
  });

  it("rejects a job of an unknown type", async () => {
    await expect(
      handleJob('{"type":"Unknown"}', context),
    ).rejects.toBeInstanceOf(InvalidJobError);
  });

  it("rejects a job missing a field its type needs", async () => {
    await expect(
      handleJob('{"type":"Testing"}', context),
    ).rejects.toBeInstanceOf(InvalidJobError);
  });

  it("lets a handler's own error through", async () => {
    const error = new Error("boom");

    await expect(
      handleJob('{"type":"Testing","foo":"bar"}', context, {
        Testing: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
  });
});
