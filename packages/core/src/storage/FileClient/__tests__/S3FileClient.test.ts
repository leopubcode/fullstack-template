import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3FileClient } from "../S3FileClient";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

const bucketName = "files-bucket";
const client = () => new S3FileClient(bucketName, new S3Client({}));

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
    expect(command.input).toEqual({
      Bucket: bucketName,
      Key: "uploads/a.png",
    });
    expect(options).toEqual({ expiresIn: 15 * 60 });
  });
});
