import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ui";
import { accountLabel, useSession } from "../../lib/session";

// U02. Passwords are never entered on the marketplace: the Nahj account
// sign-in (email, Google, password reset) happens on the Nahj sign-in page.
export function SignIn() {
  const { session, signIn, signInEnabled, loading } = useSession();
  const [params] = useSearchParams();
  const back = params.get("return") ?? "/";

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="grid-2 card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="stack" style={{ padding: 32, background: "linear-gradient(160deg,#5b44f0,#3b25c6)", color: "#fff" }}>
          <h1 style={{ color: "#fff" }}>Welcome back to Nahj</h1>
          <p style={{ opacity: 0.9 }}>Continue your child's learning journey. Use the same Nahj account as in the app.</p>
          <ul className="stack-sm" style={{ paddingLeft: 18, margin: 0, opacity: 0.95 }}>
            <li>One account for the web and the Nahj app</li>
            <li>Purchases and codes in one place</li>
            <li>Guest app accounts cannot buy or redeem</li>
          </ul>
        </div>
        <div className="stack" style={{ padding: 32, alignContent: "center" }}>
          {loading ? (
            <p className="muted">Checking your session…</p>
          ) : session ? (
            <>
              <Notice tone="success">You are signed in as {accountLabel(session)}.</Notice>
              <Link to={back} className="btn btn-primary">
                Continue <Icon name="arrow" />
              </Link>
            </>
          ) : (
            <>
              <h2>Sign in or create your Nahj account</h2>
              <p className="muted">You will continue on the secure Nahj sign-in page, where you can use email and password, Google, or reset your password.</p>
              <button className="btn btn-primary btn-block" onClick={() => signIn(back)} disabled={!signInEnabled}>
                <Icon name="lock" /> Continue to sign in
              </button>
              {!signInEnabled && <Notice tone="warning">Sign-in is not configured on this server yet (Keycloak client secret missing).</Notice>}
              <p className="muted small">
                By signing in, you agree to our <Link to="/help?tab=policies">Terms</Link> and <Link to="/help?tab=policies">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
