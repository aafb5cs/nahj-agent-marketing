import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Pill, SampleBadge, Steps } from "../../components/ui";
import { planBy, SELLER_ORDERS, sellerOrderPill, WALLET } from "../../data/sample";
import { rupiah } from "../../lib/format";
import { SignedOutNote } from "../../shells/common";

// U12 Seller Home.
export function SellerHome() {
  return (
    <div className="seller-page">
      <SignedOutNote what="your sales" />
      <Link to="/seller/settings" className="card row-between" style={{ padding: 14, color: "inherit", textDecoration: "none" }}>
        <span className="row" style={{ gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)" }} />
          <b className="small">You are available to sell</b>
        </span>
        <span className="muted">›</span>
      </Link>
      <div className="seller-hero">
        <h2 style={{ color: "#fff" }}>Create a new sale request</h2>
        <p style={{ opacity: 0.9 }}>Share a payment link. The customer pays Nahj, and gets VIP or codes right away.</p>
        <Link to="/seller/create" className="btn">
          <Icon name="plus" /> Create Sale
        </Link>
      </div>
      <div className="card stack-sm">
        <div className="row-between">
          <h3>Available earnings</h3>
          <SampleBadge step="step 5" />
        </div>
        <div className="row" style={{ gap: 24 }}>
          <div className="stat">
            <span>Available</span>
            <b className="num">{rupiah(WALLET.available)}</b>
          </div>
          <div className="stat">
            <span>Pending</span>
            <b className="num" style={{ fontSize: "1.1rem" }}>
              {rupiah(WALLET.pending)}
            </b>
          </div>
        </div>
      </div>
      <div className="card stack-sm">
        <div className="row-between">
          <h3>Recent sales</h3>
          <Link to="/seller/orders" className="small">
            View all
          </Link>
        </div>
        {SELLER_ORDERS.slice(0, 3).map((o) => {
          const [t, l] = sellerOrderPill[o.status];
          return (
            <Link key={o.ref} to={`/seller/orders/${o.ref}`} className="row-between" style={{ padding: "10px 0", borderTop: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
              <div>
                <b className="small num">{o.ref}</b>
                <div className="muted small">
                  {planBy(o.plan).name} × {o.qty} {o.channel === "store" && "· App store"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Pill tone={t}>{l}</Pill>
                <div className="num small" style={{ fontWeight: 700, marginTop: 4 }}>
                  {rupiah(o.total)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// "More" tab: Referrals, Support, Settings.
export function SellerMore() {
  const items = [
    { to: "/seller/referrals", icon: "users", label: "Referrals", text: "Invite sellers and track monthly progress" },
    { to: "/seller/support", icon: "chat", label: "Support", text: "Customer conversations and help from Nahj" },
    { to: "/seller/settings", icon: "gear", label: "Settings", text: "Profile, agent code, availability, security" },
    { to: "/seller/apply", icon: "store", label: "Seller application", text: "View the application form" },
  ];
  return (
    <div className="seller-page">
      <h1>More</h1>
      <div className="card stack-sm" style={{ padding: 8 }}>
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
            <span className="tile" style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary-soft)", color: "var(--primary)" }}>
              <Icon name={i.icon} />
            </span>
            <div style={{ flex: 1 }}>
              <b>{i.label}</b>
              <div className="muted small">{i.text}</div>
            </div>
            <span className="muted">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// U11 Become a Seller.
export function SellerApply() {
  const [step, setStep] = useState(0);
  return (
    <div className="seller-page">
      <div className="stack-sm">
        <h1>Become a Seller</h1>
        <p className="muted">Share learning. Make a difference.</p>
        <SampleBadge step="step 2" />
      </div>
      <div className="card">
        <Steps current={step} steps={[{ title: "Details" }, { title: "Profile" }, { title: "Verify" }, { title: "Review" }]} />
      </div>
      {step === 0 && (
        <div className="card stack">
          <h2>Your details</h2>
          <div className="field">
            <label htmlFor="apply-name">Full name</label>
            <input id="apply-name" className="input" defaultValue="Siti Rahmawati" />
          </div>
          <div className="field">
            <label htmlFor="apply-phone">Phone number</label>
            <input id="apply-phone" className="input" defaultValue="+62 812 3456 7890" />
          </div>
          <div className="field">
            <label htmlFor="apply-city">City</label>
            <select id="apply-city" className="select" defaultValue="Bandung">
              {["Bandung", "Jakarta", "Surabaya", "Yogyakarta", "Medan", "Bekasi"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>
            Save & continue
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="card stack">
          <h2>Public profile</h2>
          <div className="field">
            <label htmlFor="apply-public">Public name</label>
            <input id="apply-public" className="input" defaultValue="Ruang Belajar Ceria" />
            <span className="hint">Must be unique and must not look like an official Nahj name.</span>
          </div>
          <div className="field">
            <label htmlFor="apply-about">Short description</label>
            <textarea id="apply-about" className="textarea" rows={3} defaultValue="Educational content for brighter minds." />
          </div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="card stack">
          <h2>Verification</h2>
          <p className="muted">Nahj may ask for documents during review. You will be told exactly what is needed.</p>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="card stack">
          <h2>Submitted for review</h2>
          <p className="muted">We'll let you know when your application is approved. After approval, set up two-step sign-in and accept the seller terms to start selling.</p>
          <Link to="/seller" className="btn btn-primary">
            Go to Seller Home
          </Link>
        </div>
      )}
    </div>
  );
}
