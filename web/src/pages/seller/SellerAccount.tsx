import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { copyText, KV, Notice, Pill, SampleBadge, Tabs } from "../../components/ui";
import { CONVERSATIONS } from "../../data/sample";
import { date } from "../../lib/format";

// U18 Seller Settings, including the agent code for app-store sales.
export function SellerSettings() {
  const [tab, setTab] = useState<"profile" | "agent" | "availability" | "security">("profile");
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState("");
  const code = "AGT-7K2M3P";
  const link = "https://nahj.ryam.app/a/AGT7K2M3P";
  return (
    <div className="seller-page">
      <div className="row-between">
        <h1>Settings</h1>
        <SampleBadge step="step 2" />
      </div>
      <Tabs
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "agent", label: "Agent code" },
          { id: "availability", label: "Availability" },
          { id: "security", label: "Security" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "profile" && (
        <div className="card stack">
          <div className="field">
            <label htmlFor="pub-name">Public name</label>
            <input id="pub-name" className="input" defaultValue="Ruang Belajar Ceria" />
          </div>
          <div className="field">
            <label htmlFor="pub-about">Short description</label>
            <textarea id="pub-about" className="textarea" rows={3} maxLength={120} defaultValue="Educational content for brighter minds." />
          </div>
          <div className="field">
            <label htmlFor="pub-city">City</label>
            <input id="pub-city" className="input" defaultValue="Jakarta" />
          </div>
          <Notice>Profile changes are reviewed before they go live. Your current profile stays visible meanwhile.</Notice>
          <button className="btn btn-primary">Submit for review</button>
        </div>
      )}
      {tab === "agent" && (
        <div className="card stack">
          <div>
            <h3>Your agent code</h3>
            <p className="muted small">Customers enter it in the Nahj app before buying VIP from Google Play or the App Store. You earn commission on those purchases.</p>
          </div>
          <div className="row-between" style={{ padding: 14, border: "1px dashed #cfc8fb", borderRadius: 12, background: "var(--primary-soft)" }}>
            <b className="num" style={{ fontSize: "1.4rem", letterSpacing: "0.06em" }}>
              {code}
            </b>
            <button className="btn btn-outline btn-sm" onClick={async () => setCopied((await copyText(code)) ? "code" : "")}>
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="row" style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
            <span className="num small" style={{ flex: 1, overflowWrap: "anywhere" }}>
              {link}
            </span>
            <button className="btn btn-outline btn-sm" onClick={async () => setCopied((await copyText(link)) ? "link" : "")}>
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
          <span className="hint">The link opens the Nahj app with your code filled in. You can ask Nahj for a custom alias such as TOKOILMU.</span>
        </div>
      )}
      {tab === "availability" && (
        <div className="card stack">
          <div className="row-between">
            <div>
              <b>{paused ? "Paused" : "Available to sell"}</b>
              <div className="muted small">Pausing hides you from Find a Seller. Your links and agent code keep working.</div>
            </div>
            <button className={`btn ${paused ? "btn-primary" : "btn-outline"}`} onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      )}
      {tab === "security" && (
        <div className="card stack">
          <KV items={[["Two-step sign-in (TOTP)", <Pill tone="success">On</Pill>], ["Seller terms", "Version 1 accepted"]]} />
          <span className="hint">Two-step sign-in is required for sellers and for every withdrawal.</span>
        </div>
      )}
    </div>
  );
}

// U19 Seller Support.
export function SellerSupport() {
  const [active, setActive] = useState(CONVERSATIONS[0]!.id);
  const c = CONVERSATIONS.find((x) => x.id === active)!;
  return (
    <div className="seller-page">
      <div className="row-between">
        <h1>Support</h1>
        <SampleBadge step="step 8" />
      </div>
      <div className="card stack-sm" style={{ padding: 8 }}>
        {CONVERSATIONS.map((x) => (
          <button key={x.id} className="list-item" aria-current={x.id === active} onClick={() => setActive(x.id)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="small">
                {x.who} · {x.topic}
              </b>
              <div className="muted small num">{x.ref}</div>
            </div>
            <span className="muted small">{date(x.at)}</span>
            {x.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />}
          </button>
        ))}
      </div>
      <div className="card stack">
        <div className="thread">
          {c.messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from === "me" ? "me" : ""}`}>
              <b>{m.from === "me" ? "You" : c.who}</b>
              {m.text}
            </div>
          ))}
        </div>
        <input id="seller-reply" className="input" placeholder="Write a reply…" aria-label="Reply" />
        <div className="row">
          <button className="btn btn-primary">Send</button>
          <Link to={`/seller/orders/${c.ref}`} className="btn btn-outline">
            Open order
          </Link>
          <button className="btn btn-ghost">
            <Icon name="help" /> Ask Nahj for help
          </button>
        </div>
      </div>
    </div>
  );
}
