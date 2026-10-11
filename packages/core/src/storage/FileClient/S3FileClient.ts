import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileProvider } from "../../domain/files/fileProvider";

const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60;

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
}
