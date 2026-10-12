import { S3Client } from "@aws-sdk/client-s3";

// Configured by the SDK's standard environment (AWS_REGION, AWS_ENDPOINT_URL, …).
// Locally, AWS_ENDPOINT_URL_S3 must point at s3.localhost.localstack.cloud:
// LocalStack doesn't route the <bucket>.localhost host the SDK would otherwise
// sign presigned URLs for.
//
// WHEN_REQUIRED keeps the SDK from signing a checksum of an empty body into
// presigned PUT URLs, which S3 would then reject for any real upload.
export const s3Client = new S3Client({
  requestChecksumCalculation: "WHEN_REQUIRED",
});
