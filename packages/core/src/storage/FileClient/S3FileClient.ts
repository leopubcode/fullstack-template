import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileProvider } from "../../domain/files/fileProvider";
import type { StoredFile } from "../../domain/files/types";

const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60;
const DOWNLOAD_URL_EXPIRY_SECONDS = 15 * 60;

export class S3FileClient implements FileProvider {
  constructor(
    private readonly bucketName: string,
    private readonly client: S3Client,
  ) {}

  createUploadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
    );
  }

  createDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS },
    );
  }

  async list(prefix: string): Promise<StoredFile[]> {
    const files: StoredFile[] = [];
    let continuationToken: string | undefined;

    // S3 returns at most 1,000 keys per page.
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) {
        files.push({
          key: object.Key!,
          size: object.Size ?? 0,
          lastModified: object.LastModified!,
        });
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    return files;
  }
}
