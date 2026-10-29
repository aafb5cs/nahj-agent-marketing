import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Notice, SampleBadge, Tabs } from "../../components/ui";

const TOPICS = ["Getting Started", "Subscription & Purchase", "Redeem Code", "Account & Sign In", "For Parents", "For Sellers"] as const;

const ARTICLES: Record<string, { q: string; a: string }[]> = {
  "Getting Started": [
    { q: "What is Nahj?", a: "Nahj is an educational app that helps children learn through structured lessons, interactive activities and a clear progress-based journey. VIP gives full access to all learning content." },
    { q: "Where can I download the Nahj app?", a: "Nahj is on Google Play and the App Store. Sign in to the app with the same account you use here." },
  ],
  "Subscription & Purchase": [
    { q: "How does the subscription work?", a: "Every pass is prepaid and does not renew automatically. New time is added after your current VIP time ends, so you never lose days." },
    { q: "What does Lifetime mean?", a: "Lifetime gives VIP for as long as your Nahj account exists. It is shown with its end date in your account." },
    { q: "Can I get a refund?", a: "A pass can be refunded within 48 hours after it is activated. Unused codes can be refunded within 30 days after payment. Ask from the purchase page." },
  ],
  "Redeem Code": [
    { q: "How do I redeem a code?", a: "Open Redeem Code, sign in, enter the code, check what you will get, and confirm. The days start when you redeem, not when the code was bought." },
    { q: "The code says already used", a: "Each code works once. If you think this is wrong, contact the seller or Nahj support." },
  ],
  "Account & Sign In": [{ q: "Can I use a guest account?", a: "No. Buying and redeeming need a full Nahj account, so your VIP time is never lost." }],
  "For Parents": [{ q: "Is Nahj suitable for my child?", a: "Nahj is designed for young children, with a parent area protected by a parental gate." }],
  "For Sellers": [{ q: "How do sellers earn?", a: "Sellers earn commission on each paid unit. It becomes available after a waiting period, and they can withdraw to a bank account or e-wallet." }],
};

export function Help() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"help" | "policies">(params.get("tab") === "policies" ? "policies" : "help");
  const [topic, setTopic] = useState<string>("Getting Started");
  const [open, setOpen] = useState(0);
  const articles = ARTICLES[topic] ?? [];

  return (
    <div className="page">
      <div className="card stack" style={{ textAlign: "center", justifyItems: "center", padding: 32 }}>
        <h1>How can we help?</h1>
        <p className="muted">Find answers, or get in touch with our support team.</p>
        <SampleBadge step="help content" />
      </div>
      <Tabs tabs={[{ id: "help", label: "Help topics" }, { id: "policies", label: "Policies" }]} value={tab} onChange={setTab} />
      {tab === "help" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) 1fr", gap: 20 }} className="help-grid">
          <nav className="card stack-sm" style={{ padding: 10, alignSelf: "start" }} aria-label="Help topics">
            {TOPICS.map((t) => (
              <button key={t} className="list-item" aria-current={t === topic} onClick={() => { setTopic(t); setOpen(0); }}>
                {t}
              </button>
            ))}
          </nav>
          <div className="stack">
            {articles.map((a, i) => (
              <div key={a.q} className="card stack-sm">
                <button className="row-between" style={{ border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left" }} onClick={() => setOpen(i)} aria-expanded={open === i}>
                  <h3>{a.q}</h3>
                  <span className="muted">{open === i ? "−" : "+"}</span>
                </button>
                {open === i && <p className="muted">{a.a}</p>}
              </div>
            ))}
            <div className="card row-between">
              <div>
                <h3>Still need help?</h3>
                <p className="muted small">Message your seller or the Nahj team.</p>
              </div>
              <Link to="/support" className="btn btn-primary">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {["Terms of Use", "Privacy Policy", "Refund Policy", "Seller Terms"].map((p) => (
            <div key={p} className="card stack-sm">
              <h3>{p}</h3>
              <p className="muted small">Versioned policy text. Orders record the version you accepted.</p>
              <Notice tone="warning">The final text is still being written.</Notice>
            </div>
          ))}
        </div>
      )}
      <style>{`@media (max-width: 760px){.help-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
