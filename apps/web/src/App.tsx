import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useState } from "react";
import type { AppRouter } from "@repo/core";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { TRPCProvider } from "./trpc";
import { Test } from "./Test";
import { Home } from "./pages/Home";
import { About } from "./pages/About";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

function Nav() {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 flex gap-6 py-3">
        <Link
          to="/"
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
        >
          Home
        </Link>
        <Link
          to="/about"
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
        >
          About
        </Link>
      </div>
    </nav>
  );
}

export function App() {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          // The API serves procedures from its root (see apps/api).
          url: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <Nav />
          <main>
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <Home />
                    <div className="max-w-2xl mx-auto px-4 pb-12">
                      <Test />
                    </div>
                  </>
                }
              />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </BrowserRouter>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
