import type { FileProvider } from "../../domain/files/fileProvider";
import type { StoredFile } from "../../domain/files/types";

// Test double for the file provider. Returns fake URLs that carry the key,
// and records every upload key requested so a test can assert on it. Nothing
// is ever uploaded to it, so tests add stored files with addFile.
export class InMemoryFileClient implements FileProvider {
  readonly requestedKeys: string[] = [];
  private readonly files = new Map<string, StoredFile>();

  async createUploadUrl(key: string): Promise<string> {
    this.requestedKeys.push(key);
    return `https://in-memory-file-client.test/${encodeURIComponent(key)}`;
  }

  async createDownloadUrl(key: string): Promise<string> {
    return `https://in-memory-file-client.test/${encodeURIComponent(key)}?download`;
  }

  async list(prefix: string): Promise<StoredFile[]> {
    return [...this.files.values()]
      .filter((file) => file.key.startsWith(prefix))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  addFile(file: StoredFile): void {
    this.files.set(file.key, file);
  }
}
