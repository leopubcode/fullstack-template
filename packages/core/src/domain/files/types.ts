// A file the provider holds, as it reports it.
export interface StoredFile {
  key: string;
  // In bytes.
  size: number;
  lastModified: Date;
}
