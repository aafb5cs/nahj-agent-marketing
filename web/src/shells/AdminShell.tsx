import { NavLink, Outlet } from "react-router-dom";
import { Avatar } from "../components/ui";
import { Icon } from "../components/Icon";
import { accountLabel, useSession } from "../lib/session";
import { Brand, PreviewBanner } from "./common";

const NAV = [
  { to: "/admin", label: "Home", icon: "home", end: true },
  { to: "/admin/sellers", label: "Sellers", icon: "store" },
  { to: "/admin/orders", label: "Orders", icon: "list" },
  { to: "/admin/customers", label: "Customers", icon: "users" },
  { to: "/admin/payouts", label: "Payouts", icon: "payout" },
  { to: "/admin/support", label: "Support", icon: "chat" },
  { to: "/admin/settings", label: "Settings", icon: "gear" },
];

export function AdminShell() {
  const { session, signOut, signIn, signInEnabled } = useSession();
  const name = session ? accountLabel(session) : "Not signed in";
  return (
    <>
      <PreviewBanner />
      <div className="admin">
        <aside className="sidebar">
          <Brand suffix="Admin" />
          <nav aria-label="Admin">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon name={n.icon} /> {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="stack-sm">
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={name} size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{name}</div>
                <div className="muted small">{session?.staff ? "Staff" : session ? "Not staff" : "Preview"}</div>
              </div>
            </div>
            {session ? (
              <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            ) : (
              signInEnabled && (
                <button className="btn btn-outline btn-sm" onClick={() => signIn()}>
                  Sign in
                </button>
              )
            )}
          </div>
        </aside>
        <div className="admin-main">
          <nav className="admin-top" aria-label="Admin (small screens)">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          {session && !session.staff && (
            <div className="admin-page" style={{ paddingBottom: 0 }}>
              <div className="notice notice-warning">Your account is not staff, so the server will refuse every admin action. This preview still shows the screens.</div>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </>
  );
}
