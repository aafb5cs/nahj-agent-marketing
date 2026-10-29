import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { KV, Notice, PageHead, Pill, SampleBadge, Tabs } from "../../components/ui";
import { accountLabel, useSession } from "../../lib/session";
import { SignedOutNote } from "../../shells/common";

const GRANTS = [
  { source: "Google Play", plan: "Monthly", from: "1 Oct 2026", to: "31 Oct 2026", status: "Ended" },
  { source: "Marketplace code", plan: "Yearly", from: "31 Oct 2026", to: "31 Oct 2027", status: "Active" },
];

// U09 My Account and Subscription.
export function Account() {
  const { session } = useSession();
  const [tab, setTab] = useState<"subscription" | "account" | "security">("subscription");
  return (
    <div className="page">
      <PageHead title="My Account" subtitle="Your subscription, account details and security." />
      <SignedOutNote what="your subscription" />
      <Tabs tabs={[{ id: "subscription", label: "Subscription" }, { id: "account", label: "Account" }, { id: "security", label: "Security" }]} value={tab} onChange={setTab} />

      {tab === "subscription" && (
        <div className="stack">
          <div className="card stack">
            <div className="row-between">
              <div className="row">
                <h2>VIP</h2>
                <Pill tone="success">Active</Pill>
                <SampleBadge step="step 4" />
              </div>
              <button className="btn btn-outline btn-sm">Refresh access</button>
            </div>
            <KV
              items={[
                ["Active until", "31 Oct 2027"],
                ["Coverage", "All lessons and features"],
                ["Last refreshed", "Just now"],
              ]}
            />
            <Notice tone="success">Your VIP is active. Sign in to the Nahj app with this account to use it on Android and iOS.</Notice>
            <div className="row">
              <Link to="/redeem" className="btn btn-primary">
                Redeem a code
              </Link>
              <Link to="/sellers" className="btn btn-outline">
                Buy more time
              </Link>
            </div>
          </div>
          <div className="card stack">
            <h3>Where your VIP time comes from</h3>
            <p className="muted small">Each purchase adds its days after the time you already have.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Plan</th>
                    <th>From</th>
                    <th>Until</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {GRANTS.map((g) => (
                    <tr key={g.source + g.from}>
                      <td>{g.source}</td>
                      <td>{g.plan}</td>
                      <td>{g.from}</td>
                      <td>{g.to}</td>
                      <td>
                        <Pill tone={g.status === "Active" ? "success" : "neutral"}>{g.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "account" && (
        <div className="card stack">
          <KV
            items={[
              ["Account", session ? accountLabel(session) : "Not signed in"],
              ["Account ID", session?.accountId ?? "—"],
              ["Signed in via", session ? (session.via === "session" ? "Web (Nahj sign-in)" : "App token") : "—"],
            ]}
          />
          <p className="muted small">Name, email and password are managed on your Nahj account, the same one you use in the app.</p>
        </div>
      )}

      {tab === "security" && (
        <div className="card stack">
          <KV items={[["Last sign-in", session ? new Date(session.authTime).toLocaleString() : "—"]]} />
          <button className="btn btn-outline" style={{ justifySelf: "start" }}>
            <Icon name="logout" /> Sign out of other devices
          </button>
          <span className="hint">Comes with the account security step.</span>
        </div>
      )}
    </div>
  );
}
