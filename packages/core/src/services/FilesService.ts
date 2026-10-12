import type { FileProvider } from "../domain/files/fileProvider";

const IMAGES_PREFIX = "images/";

export interface ImageUpload {
  // Where the image will live once uploaded.
  key: string;
  // The caller PUTs the image's bytes here, straight to the file provider.
  uploadUrl: string;
}

export interface UploadedImage {
  key: string;
  // In bytes.
  size: number;
  // ISO 8601, as tRPC sends JSON and has no transformer for Dates here.
  uploadedAt: string;
  // A short-lived URL to show the image from.
  url: string;
}

export class FilesService {
  constructor(private readonly files: FileProvider) {}

  // Every upload gets a fresh key, so one can never overwrite another.
  async createImageUpload(): Promise<ImageUpload> {
    const key = `${IMAGES_PREFIX}${crypto.randomUUID()}`;
    const uploadUrl = await this.files.createUploadUrl(key);
    return { key, uploadUrl };
  }

  // Every uploaded image, newest first.
  async listImages(): Promise<UploadedImage[]> {
    const files = await this.files.list(IMAGES_PREFIX);
    const newestFirst = files.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
    );

    return Promise.all(
      newestFirst.map(async (file) => ({
        key: file.key,
        size: file.size,
        uploadedAt: file.lastModified.toISOString(),
        url: await this.files.createDownloadUrl(file.key),
      })),
    );
  }
}
