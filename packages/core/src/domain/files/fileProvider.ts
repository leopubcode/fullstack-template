// Where services reach for file storage. Services never know which provider
// sits behind it.
export interface FileProvider {
  // A URL the caller can PUT the file's bytes to directly, bypassing our
  // servers. Expires a short time after it's issued.
  createUploadUrl(key: string): Promise<string>;
}
