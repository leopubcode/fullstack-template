import { describe, expect, it } from "vitest";
import { InMemoryFileClient } from "../InMemoryFileClient";

describe("the in-memory file client", () => {
  it("returns a fake URL carrying the requested key", async () => {
    const client = new InMemoryFileClient();

    await expect(client.createUploadUrl("uploads/a.png")).resolves.toBe(
      "https://in-memory-file-client.test/uploads%2Fa.png",
    );
  });

  it("records every key requested", async () => {
    const client = new InMemoryFileClient();

    await client.createUploadUrl("a");
    await client.createUploadUrl("b");

    expect(client.requestedKeys).toEqual(["a", "b"]);
  });
});
