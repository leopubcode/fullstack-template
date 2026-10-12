import type { StoredFile } from "./types";

// Where services reach for file storage. Services never know which provider
// sits behind it.
export interface FileProvider {
  // A URL the caller can PUT the file's bytes to directly, bypassing our
  // servers. Expires a short time after it's issued.
  createUploadUrl(key: string): Promise<string>;
  // A URL the caller can GET the file from directly. Expires a short time
  // after it's issued.
  createDownloadUrl(key: string): Promise<string>;
  // Every file whose key starts with the prefix, in key order.
  list(prefix: string): Promise<StoredFile[]>;
}
