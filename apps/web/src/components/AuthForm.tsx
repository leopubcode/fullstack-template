import { TRPCClientError } from "@trpc/client";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";

// The layout and controls the sign-up, confirm and sign-in pages share.

export function AuthForm({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (form: FormData) => void;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        {title}
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {children}
      </form>
    </div>
  );
}

export function Field({
  label,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <input
        {...input}
        className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-base font-normal text-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-slate-800 dark:bg-slate-100 px-4 py-2 font-medium text-white dark:text-slate-900 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: ReactNode;
}) {
  if (!children) {
    return null;
  }
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "text-sm text-red-600 dark:text-red-400"
          : "text-sm text-slate-600 dark:text-slate-400"
      }
    >
      {children}
    </p>
  );
}

// The tRPC error code a failed call was answered with, if any.
export function errorCode(error: unknown): string | undefined {
  return error instanceof TRPCClientError
    ? (error.data as { code?: string } | undefined)?.code
    : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof TRPCClientError &&
    errorCode(error) !== "INTERNAL_SERVER_ERROR"
    ? error.message
    : "Something went wrong. Please try again.";
}
