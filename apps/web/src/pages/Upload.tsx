import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "../trpc";

// Asks the API for a presigned URL, then PUTs the image straight to the
// bucket: the bytes never pass through the API.
async function uploadImage(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadedImages() {
  const trpc = useTRPC();
  const images = useQuery(trpc.listImages.queryOptions());

  if (images.isPending) {
    return <p className="text-slate-600 dark:text-slate-400">Loading…</p>;
  }
  if (images.isError) {
    return (
      <p className="text-red-700 dark:text-red-400">{images.error.message}</p>
    );
  }
  if (images.data.length === 0) {
    return (
      <p className="text-slate-600 dark:text-slate-400">
        No images uploaded yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {images.data.map((image) => (
        <li
          key={image.key}
          className="flex items-center gap-4 rounded border border-slate-200 p-2 dark:border-slate-700"
        >
          <a href={image.url} target="_blank" rel="noreferrer">
            <img
              src={image.url}
              alt={image.key}
              className="h-16 w-16 rounded object-cover"
            />
          </a>
          <div className="min-w-0 text-sm">
            <code className="block truncate text-slate-800 dark:text-slate-100">
              {image.key}
            </code>
            <span className="text-slate-600 dark:text-slate-400">
              {formatSize(image.size)} ·{" "}
              {new Date(image.uploadedAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Upload() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createImageUpload = useMutation(
    trpc.createImageUpload.mutationOptions(),
  );
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [uploadedKey, setUploadedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(undefined);
    setUploadedKey(undefined);
    try {
      const { key, uploadUrl } = await createImageUpload.mutateAsync();
      await uploadImage(uploadUrl, file);
      setUploadedKey(key);
      await queryClient.invalidateQueries({
        queryKey: trpc.listImages.queryKey(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : undefined);
    setUploadedKey(undefined);
    setError(undefined);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
        Upload an image
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="text-slate-600 dark:text-slate-400"
        />
        {preview && (
          <img
            src={preview}
            alt="Selected image"
            className="max-h-64 self-start rounded border border-slate-200 dark:border-slate-700"
          />
        )}
        <button
          type="submit"
          disabled={!file || uploading}
          className="self-start rounded bg-slate-800 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
      {uploadedKey && (
        <p className="mt-4 text-green-700 dark:text-green-400">
          Uploaded as <code>{uploadedKey}</code>
        </p>
      )}
      {error && <p className="mt-4 text-red-700 dark:text-red-400">{error}</p>}

      <h2 className="mt-12 mb-4 text-xl font-bold text-slate-800 dark:text-slate-100">
        Uploaded images
      </h2>
      <UploadedImages />
    </div>
  );
}
