import { NavLink, Outlet, Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PreviewBanner } from "./common";

const TABS = [
  { to: "/seller", label: "Home", icon: "home", end: true },
  { to: "/seller/orders", label: "Orders", icon: "list" },
  { to: "/seller/create", label: "Create Sale", icon: "plus", fab: true },
  { to: "/seller/wallet", label: "Wallet", icon: "wallet" },
  { to: "/seller/more", label: "More", icon: "menu" },
];

export function SellerShell() {
  return (
    <>
      <PreviewBanner />
      <div className="seller-app">
        <header className="seller-top">
          <Link to="/seller" className="brand" aria-label="Nahj Seller home">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#4b32e6" />
              <path d="M8 24 16 7l8 17h-4.4L16 16l-3.6 8z" fill="#fff" />
            </svg>
            <span>Nahj Seller</span>
          </Link>
          <div className="row" style={{ gap: 4 }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              Website
            </Link>
            <button className="icon-btn" aria-label="Notifications">
              <Icon name="bell" size={20} />
            </button>
          </div>
        </header>
        <Outlet />
      </div>
      <nav className="tabbar" aria-label="Seller">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `${isActive ? "active" : ""} ${t.fab ? "fab" : ""}`}>
              <span>
                <Icon name={t.icon} size={t.fab ? 22 : 20} />
              </span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
