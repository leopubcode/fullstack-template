// The signed-in session's tokens, persisted to localStorage and shared by the
// tRPC client (which sends and refreshes them) and the auth hook (which
// renders from them). Framework-free so both can use it.

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  // When the access token expires, in epoch milliseconds.
  expiresAt: number;
}

const STORAGE_KEY = "auth.tokens";

type Listener = () => void;

export interface TokenStore {
  get(): AuthTokens | null;
  set(tokens: AuthTokens): void;
  clear(): void;
  subscribe(listener: Listener): () => void;
}

export function createTokenStore(storage: () => Storage = () => localStorage) {
  let tokens = read();
  const listeners = new Set<Listener>();

  function read(): AuthTokens | null {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  }

  function update(next: AuthTokens | null) {
    tokens = next;
    try {
      if (next) {
        storage().setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        storage().removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage unavailable (private mode, blocked): keep the session in
      // memory only.
    }
    listeners.forEach((listener) => listener());
  }

  // Follow sign-ins and sign-outs made in other tabs.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        tokens = read();
        listeners.forEach((listener) => listener());
      }
    });
  }

  return {
    get: () => tokens,
    set: (next) => update(next),
    clear: () => update(null),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies TokenStore;
}

export const tokenStore: TokenStore = createTokenStore();
