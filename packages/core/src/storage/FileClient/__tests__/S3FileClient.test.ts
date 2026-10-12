import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3FileClient } from "../S3FileClient";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

const bucketName = "files-bucket";
const client = (s3 = new S3Client({})) => new S3FileClient(bucketName, s3);

beforeEach(() => {
  vi.mocked(getSignedUrl).mockReset();
});

describe("the S3 file client", () => {
  it("returns a presigned URL for the given key", async () => {
    vi.mocked(getSignedUrl).mockResolvedValue("https://example.test/signed");

    await expect(client().createUploadUrl("uploads/a.png")).resolves.toBe(
      "https://example.test/signed",
    );
  });

  it("presigns a PutObject for the bucket and key", async () => {
    vi.mocked(getSignedUrl).mockResolvedValue("https://example.test/signed");

    await client().createUploadUrl("uploads/a.png");

    const [, command, options] = vi.mocked(getSignedUrl).mock.calls[0]!;
    expect(command.constructor.name).toBe("PutObjectCommand");
    expect(command.input).toEqual({
      Bucket: bucketName,
      Key: "uploads/a.png",
    });
    expect(options).toEqual({ expiresIn: 15 * 60 });
  });

  it("presigns a GetObject for a download", async () => {
    vi.mocked(getSignedUrl).mockResolvedValue("https://example.test/get");

    await expect(client().createDownloadUrl("uploads/a.png")).resolves.toBe(
      "https://example.test/get",
    );

    const [, command, options] = vi.mocked(getSignedUrl).mock.calls[0]!;
    expect(command.constructor.name).toBe("GetObjectCommand");
    expect(command.input).toEqual({
      Bucket: bucketName,
      Key: "uploads/a.png",
    });
    expect(options).toEqual({ expiresIn: 15 * 60 });
  });

  it("lists every page of objects under the prefix", async () => {
    const s3 = new S3Client({});
    const first = new Date("2026-01-01T00:00:00Z");
    const second = new Date("2026-01-02T00:00:00Z");
    const send = vi
      .spyOn(s3, "send")
      .mockResolvedValueOnce({
        Contents: [{ Key: "uploads/a", Size: 1, LastModified: first }],
        NextContinuationToken: "page-2",
      } as never)
      .mockResolvedValueOnce({
        Contents: [{ Key: "uploads/b", Size: 2, LastModified: second }],
      } as never);

    expect(await client(s3).list("uploads/")).toEqual([
      { key: "uploads/a", size: 1, lastModified: first },
      { key: "uploads/b", size: 2, lastModified: second },
    ]);

    const inputs = send.mock.calls.map(
      ([command]) => (command as ListObjectsV2Command).input,
    );
    expect(inputs).toEqual([
      { Bucket: bucketName, Prefix: "uploads/", ContinuationToken: undefined },
      { Bucket: bucketName, Prefix: "uploads/", ContinuationToken: "page-2" },
    ]);
  });

  it("lists nothing when the prefix is empty", async () => {
    const s3 = new S3Client({});
    vi.spyOn(s3, "send").mockResolvedValueOnce({} as never);

    expect(await client(s3).list("uploads/")).toEqual([]);
  });
});
