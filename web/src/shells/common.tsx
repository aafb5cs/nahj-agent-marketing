import { Link } from "react-router-dom";
import { useSession } from "../lib/session";

export function Brand({ suffix }: { suffix?: string }) {
  return (
    <Link to="/" className="brand" aria-label="Nahj home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#4b32e6" />
        <path d="M8 24 16 7l8 17h-4.4L16 16l-3.6 8z" fill="#fff" />
      </svg>
      <span>
        Nahj{suffix && <span style={{ fontWeight: 600, color: "var(--muted)" }}> {suffix}</span>}
      </span>
    </Link>
  );
}

/** Dark strip at the top: says what is real and what is sample, and API status. */
export function PreviewBanner() {
  const { apiProblem, signInEnabled, loading } = useSession();
  return (
    <div className="preview-banner" role="status">
      {apiProblem
        ? apiProblem
        : loading
          ? "Connecting to the API…"
          : `Preview build · sign-in is ${signInEnabled ? "live (Keycloak)" : "off on this server"} · screens marked "Sample data" are not connected yet`}
    </div>
  );
}

/** Shown on screens that need an account, while the user is signed out. */
export function SignedOutNote({ what = "your own data" }: { what?: string }) {
  const { session, signIn, signInEnabled, loading } = useSession();
  if (loading || session) return null;
  return (
    <div className="notice notice-warning" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
      <span>You are not signed in. This preview shows sample data; sign in to see {what}.</span>
      {signInEnabled && (
        <button className="btn btn-primary btn-sm" onClick={() => signIn()}>
          Sign in
        </button>
      )}
    </div>
  );
}
