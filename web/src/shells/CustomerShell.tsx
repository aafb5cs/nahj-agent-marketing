import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Avatar } from "../components/ui";
import { Icon } from "../components/Icon";
import { accountLabel, useSession } from "../lib/session";
import { Brand, PreviewBanner } from "./common";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/sellers", label: "Find a Seller" },
  { to: "/purchases", label: "My Purchases" },
  { to: "/redeem", label: "Redeem Code" },
  { to: "/help", label: "Help" },
];

function UserMenu() {
  const { session, signIn, signOut, signInEnabled, loading } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (loading) return <span className="muted small">…</span>;
  if (!session) {
    return (
      <div className="row" style={{ gap: 8 }}>
        <Link to="/signin" className="btn btn-ghost btn-sm">
          Sign In
        </Link>
        <button className="btn btn-primary btn-sm" onClick={() => signIn()} disabled={!signInEnabled} title={signInEnabled ? "" : "Sign-in is off on this server"}>
          Get Started
        </button>
      </div>
    );
  }
  const name = accountLabel(session);
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={name} size={28} />
        <span>{name}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <Link to="/account">My Account</Link>
          <Link to="/purchases">My Purchases</Link>
          <Link to="/support">Support</Link>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />
          <Link to="/seller">Seller portal</Link>
          {session.staff && <Link to="/admin">Admin</Link>}
          <button onClick={() => signOut()}>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="logout" size={16} /> Sign out
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function CustomerShell() {
  return (
    <>
      <PreviewBanner />
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <UserMenu />
        </div>
        <nav className="mobile-nav" aria-label="Main (mobile)">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>© PT. RYAM TECHNOLOGY SOLUTIONS · Building a brighter future through technology</span>
          <span className="row" style={{ gap: 16 }}>
            <Link to="/help">Help</Link>
            <Link to="/help?tab=policies">Privacy Policy</Link>
            <Link to="/help?tab=policies">Terms</Link>
            <Link to="/seller/apply">Become a Seller</Link>
          </span>
        </div>
      </footer>
    </>
  );
}
