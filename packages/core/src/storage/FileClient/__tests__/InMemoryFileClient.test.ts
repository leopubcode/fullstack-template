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

  it("returns a fake download URL carrying the key", async () => {
    const client = new InMemoryFileClient();

    await expect(client.createDownloadUrl("uploads/a.png")).resolves.toBe(
      "https://in-memory-file-client.test/uploads%2Fa.png?download",
    );
  });

  it("lists the added files under a prefix, in key order", async () => {
    const client = new InMemoryFileClient();
    const lastModified = new Date("2026-01-01T00:00:00Z");
    client.addFile({ key: "uploads/b", size: 2, lastModified });
    client.addFile({ key: "other/c", size: 3, lastModified });
    client.addFile({ key: "uploads/a", size: 1, lastModified });

    expect(await client.list("uploads/")).toEqual([
      { key: "uploads/a", size: 1, lastModified },
      { key: "uploads/b", size: 2, lastModified },
    ]);
  });
});
