import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, setCsrfToken } from "./api";

export interface StaffInfo {
  id: number;
  displayName: string;
  capabilities: { cap: string; market: string }[];
}

export interface SessionInfo {
  accountId: string;
  via: "session" | "bearer";
  authTime: string;
  csrfToken?: string;
  staff?: StaffInfo;
}

interface SessionState {
  loading: boolean;
  session: SessionInfo | null;
  signInEnabled: boolean;
  /** Last problem reaching the API, shown in the preview banner. */
  apiProblem: string | null;
  signIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [signInEnabled, setSignInEnabled] = useState(false);
  const [apiProblem, setApiProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api<{ signInEnabled: boolean }>("GET", "/auth/config");
        if (!cancelled) setSignInEnabled(cfg.signInEnabled);
      } catch {
        if (!cancelled) setApiProblem("The API is not reachable. Start it with: go run ./cmd/server api");
      }
      try {
        const s = await api<SessionInfo>("GET", "/auth/session");
        if (!cancelled) {
          setSession(s);
          setCsrfToken(s.csrfToken ?? "");
        }
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) {
          // 401 just means "not signed in".
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((returnTo?: string) => {
    const target = returnTo ?? window.location.pathname + window.location.search;
    window.location.href = `/api/v1/auth/login?return=${encodeURIComponent(target)}`;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("POST", "/auth/logout");
    } finally {
      setSession(null);
      setCsrfToken("");
      window.location.href = "/";
    }
  }, []);

  return <Ctx.Provider value={{ loading, session, signInEnabled, apiProblem, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

/** Short label for the signed-in account until profiles come from nahj_backend. */
export function accountLabel(s: SessionInfo | null): string {
  if (!s) return "";
  if (s.staff) return s.staff.displayName;
  return `Account ${s.accountId.slice(0, 8)}`;
}
