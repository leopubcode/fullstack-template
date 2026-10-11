import type { FileProvider } from "../../domain/files/fileProvider";

// Test double for the file provider. Returns a fake URL that carries the key,
// and records every key requested so a test can assert on it.
export class InMemoryFileClient implements FileProvider {
  readonly requestedKeys: string[] = [];

  async createUploadUrl(key: string): Promise<string> {
    this.requestedKeys.push(key);
    return `https://in-memory-file-client.test/${encodeURIComponent(key)}`;
  }
}
