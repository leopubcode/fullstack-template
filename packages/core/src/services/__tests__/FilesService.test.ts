import { describe, expect, it } from "vitest";
import { InMemoryFileClient } from "../../storage/FileClient/InMemoryFileClient";
import { FilesService } from "../FilesService";

describe("the files service", () => {
  it("hands out an upload URL for a new image key", async () => {
    const files = new InMemoryFileClient();
    const service = new FilesService(files);

    const upload = await service.createImageUpload();

    expect(upload.key).toMatch(/^images\/[0-9a-f-]{36}$/);
    expect(upload.uploadUrl).toBe(
      `https://in-memory-file-client.test/${encodeURIComponent(upload.key)}`,
    );
    expect(files.requestedKeys).toEqual([upload.key]);
  });

  it("gives every upload its own key", async () => {
    const service = new FilesService(new InMemoryFileClient());

    const first = await service.createImageUpload();
    const second = await service.createImageUpload();

    expect(second.key).not.toBe(first.key);
  });

  it("lists uploaded images newest first, with a URL to show each", async () => {
    const files = new InMemoryFileClient();
    files.addFile({
      key: "images/old",
      size: 10,
      lastModified: new Date("2026-01-01T00:00:00Z"),
    });
    files.addFile({
      key: "images/new",
      size: 20,
      lastModified: new Date("2026-02-01T00:00:00Z"),
    });
    const service = new FilesService(files);

    expect(await service.listImages()).toEqual([
      {
        key: "images/new",
        size: 20,
        uploadedAt: "2026-02-01T00:00:00.000Z",
        url: "https://in-memory-file-client.test/images%2Fnew?download",
      },
      {
        key: "images/old",
        size: 10,
        uploadedAt: "2026-01-01T00:00:00.000Z",
        url: "https://in-memory-file-client.test/images%2Fold?download",
      },
    ]);
  });

  it("lists only images", async () => {
    const files = new InMemoryFileClient();
    files.addFile({
      key: "other/a",
      size: 1,
      lastModified: new Date("2026-01-01T00:00:00Z"),
    });
    const service = new FilesService(files);

    expect(await service.listImages()).toEqual([]);
  });
});
