import { useState } from "react";
import { Avatar, Drawer, KV, Notice, PageHead, Pill, SampleBadge, Tabs } from "../../components/ui";
import { CASES, PAYOUTS, PLANS } from "../../data/sample";
import { dateTime, rupiah } from "../../lib/format";

// U24 Admin Payouts.
export function AdminPayouts() {
  const [open, setOpen] = useState<string | null>(null);
  const p = PAYOUTS.find((x) => x.ref === open);
  return (
    <div className="admin-page">
      <PageHead title="Payouts" subtitle="Withdrawal requests from sellers" badge={<SampleBadge step="step 5" />} />
      <div className="grid-4">
        {[
          ["Pending review", "1"],
          ["Second approval", "1"],
          ["Processing", "1"],
          ["Paid this month", rupiah(780000)],
        ].map(([t, v]) => (
          <div key={t} className="card stat">
            <span>{t}</span>
            <b className="num">{v}</b>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Seller</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Review reason</th>
            </tr>
          </thead>
          <tbody>
            {PAYOUTS.map((x) => (
              <tr key={x.ref} className={`clickable ${open === x.ref ? "selected" : ""}`} onClick={() => setOpen(x.ref)}>
                <td>{dateTime(x.at)}</td>
                <td style={{ fontWeight: 600 }}>{x.seller}</td>
                <td className="num">{rupiah(x.gross)}</td>
                <td>
                  <Pill tone={x.status[0]}>{x.status[1]}</Pill>
                </td>
                <td className="num">{x.ref}</td>
                <td className="small">{x.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p && (
        <Drawer
          title="Withdrawal request"
          subtitle={`${p.seller} · ${p.ref}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn btn-danger">Reject</button>
              <button className="btn btn-outline">Check payout</button>
              <button className="btn btn-primary">{p.status[1] === "Second approval" ? "Approve (second person)" : "Approve"}</button>
            </>
          }
        >
          <Pill tone={p.status[0]}>{p.status[1]}</Pill>
          <KV
            items={[
              ["Requested", dateTime(p.at)],
              ["Gross", rupiah(p.gross)],
              ["Fee", `− ${rupiah(p.fee)}`],
              ["Net payout", <b>{rupiah(p.gross - p.fee)}</b>],
              ["Destination", "BCA ****1234 · verified"],
              ["Outstanding debt", rupiah(0)],
              ["Review reason", p.reason],
            ]}
          />
          {p.status[1] === "Second approval" && <Notice>Above the threshold: a second Finance member must approve. The first approver cannot approve again.</Notice>}
          {p.status[1] === "Processing" && <Notice tone="warning">If the result is unknown, check the original transfer. Never send it again.</Notice>}
        </Drawer>
      )}
    </div>
  );
}

// U25 Admin Support.
export function AdminSupport() {
  const [active, setActive] = useState(CASES[0]!.id);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const c = CASES.find((x) => x.id === active)!;
  return (
    <div className="admin-page">
      <PageHead title="Support" subtitle="Customer and seller inquiries" badge={<SampleBadge step="step 8" />} actions={<button className="btn btn-primary">+ New case</button>} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 340px) 1fr", gap: 16 }} className="support-grid">
        <div className="card stack-sm" style={{ padding: 8, alignSelf: "start" }}>
          {CASES.map((x) => (
            <button key={x.id} className="list-item" aria-current={x.id === active} onClick={() => setActive(x.id)}>
              <Avatar name={x.who} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">
                  {x.who} · {x.topic}
                </b>
                <div className="muted small num">{x.id}</div>
              </div>
              <span className="muted small">{x.age}</span>
            </button>
          ))}
        </div>
        <div className="card stack">
          <div className="row-between">
            <div>
              <h3>
                {c.who} · {c.topic}
              </h3>
              <span className="muted small">
                {c.id} · order {c.order} · owner {c.owner}
              </span>
            </div>
            <Pill tone={c.status[0]}>{c.status[1]}</Pill>
          </div>
          <div className="thread">
            <div className="bubble">
              <b>{c.who}</b>I already paid but I still cannot access the lessons.
            </div>
            <div className="bubble me">
              <b>Sarah A.</b>Thanks, I'm checking the order and will get back to you shortly.
            </div>
            <div className="bubble internal">
              <b>Internal note · Sarah A.</b>Payment confirmed; grant was retried by the recovery job.
            </div>
          </div>
          <Tabs tabs={[{ id: "reply", label: "Reply to customer" }, { id: "note", label: "Internal note" }]} value={mode} onChange={setMode} />
          <textarea id="case-reply" className="textarea" rows={3} placeholder={mode === "reply" ? "Write a reply the customer will see…" : "Write a note only staff can see…"} aria-label="Message" />
          <div className="row">
            <button className="btn btn-primary">{mode === "reply" ? "Send reply" : "Add note"}</button>
            <button className="btn btn-outline">Open order</button>
            <button className="btn btn-ghost">Close case</button>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){.support-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

// U26 Admin Settings: versioned plans and the configurable rules agreed so far.
export function AdminSettings() {
  const [tab, setTab] = useState<"plans" | "market" | "referrals" | "team">("plans");
  return (
    <div className="admin-page">
      <PageHead title="Settings" subtitle="Platform configuration and team access" badge={<SampleBadge step="step 2" />} />
      <Tabs
        tabs={[
          { id: "plans", label: "Plans and commission" },
          { id: "market", label: "Market rules" },
          { id: "referrals", label: "Referrals" },
          { id: "team", label: "Team" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "plans" && (
        <div className="stack">
          <div className="row-between">
            <span className="muted small">Configuration version 1 · effective 1 Nov 2026</span>
            <button className="btn btn-primary">Save as new version</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Nahj item</th>
                  <th>Days</th>
                  <th>Web price</th>
                  <th>Web commission</th>
                  <th>App-store base price</th>
                  <th>App-store commission</th>
                  <th>On web</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((p) => (
                  <tr key={p.code}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="num small">vip_pass_{p.code === "6month" ? "6month" : p.code}</td>
                    <td className="num">{p.days.toLocaleString("en")}</td>
                    <td className="num">{rupiah(p.price)}</td>
                    <td className="num">10%</td>
                    <td className="num">{rupiah(p.price)}</td>
                    <td className="num">7%</td>
                    <td>
                      <Pill tone="success">Yes</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice>Existing orders keep their original terms. Changes apply only to new purchases. Prices here are placeholders.</Notice>
        </div>
      )}
      {tab === "market" && (
        <div className="grid-2">
          <div className="card stack-sm">
            <h3>Refunds</h3>
            <KV items={[["Used pass", "48 hours after activation"], ["Unused codes", "30 days after payment"]]} />
          </div>
          <div className="card stack-sm">
            <h3>Commission release</h3>
            <KV items={[["Web sales", "168 hours after settlement"], ["Codes", "Also after redemption or the 30-day end"], ["Google Play", "3 days (per-wallet override allowed)"], ["App Store", "14 days (per-wallet override allowed)"]]} />
          </div>
          <div className="card stack-sm">
            <h3>Withdrawals</h3>
            <KV items={[["Minimum", rupiah(500000)], ["Second approval above", rupiah(2000000)]]} />
          </div>
          <div className="card stack-sm">
            <h3>App-store sales</h3>
            <KV items={[["Earning currencies", "IDR"], ["Agent code format", "AGT- + 6 characters"]]} />
          </div>
        </div>
      )}
      {tab === "referrals" && (
        <div className="card stack-sm" style={{ maxWidth: 560 }}>
          <KV items={[["Monthly target", rupiah(3000000)], ["Reward rate", "1%"], ["Levels", "One level only"]]} />
          <span className="hint">Placeholder values until the business sets them.</span>
        </div>
      )}
      {tab === "team" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Capabilities</th>
                <th>Two-step sign-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Sarah A.", "Support", "On", "Active"],
                ["Rina", "Finance", "On", "Active"],
                ["Dimas", "Seller management, Finance", "On", "Active"],
              ].map(([n, c, m, s]) => (
                <tr key={n}>
                  <td style={{ fontWeight: 600 }}>{n}</td>
                  <td>{c}</td>
                  <td>
                    <Pill tone="success">{m}</Pill>
                  </td>
                  <td>
                    <Pill tone="success">{s}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
