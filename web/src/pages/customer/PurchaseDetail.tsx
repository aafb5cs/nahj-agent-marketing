import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { copyText, KV, Modal, Notice, Pill, SampleBadge, Tabs, Tile } from "../../components/ui";
import { deliveryPill, paymentPill, planBy, PURCHASES, sellerBy } from "../../data/sample";
import { dateTime, rupiah } from "../../lib/format";

const codeStatus = { ready: ["success", "Ready to use"], redeemed: ["neutral", "Redeemed"], refunded: ["danger", "Refunded"] } as const;

export function PurchaseDetail() {
  const { ref = "" } = useParams();
  const p = PURCHASES.find((x) => x.ref === ref);
  const [tab, setTab] = useState<"overview" | "codes" | "activity">(p?.codes ? "codes" : "overview");
  const [refund, setRefund] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState("");
  if (!p) return <div className="page"><div className="empty">Purchase not found. <Link to="/purchases">Back to purchases</Link></div></div>;

  const seller = sellerBy(p.sellerId)!;
  const plan = planBy(p.plan);
  const [pt, pl] = paymentPill[p.payment];
  const [dt, dl] = deliveryPill[p.delivery];
  const unused = p.codes?.filter((c) => c.status === "ready") ?? [];

  return (
    <div className="page">
      <Link to="/purchases" className="small">
        ← Back to purchases
      </Link>
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 4 }}>
          <div className="row">
            <h1 className="num">{p.ref}</h1>
            <Pill tone={dt}>{dl}</Pill>
            <SampleBadge step="step 4" />
          </div>
          <span className="muted small">Purchased {dateTime(p.at)}</span>
        </div>
        <div className="row">
          <Link to="/support" className="btn btn-outline">
            Get help
          </Link>
          <button className="btn btn-primary" onClick={() => setRefund(true)} disabled={p.payment !== "paid"}>
            Request refund
          </button>
        </div>
      </div>

      {p.payment === "checking" && <Notice tone="warning">We are confirming this payment with the bank. Do not pay again. This page updates by itself.</Notice>}

      <div className="grid-2">
        <div className="card row">
          <Tile name={seller.name} />
          <div style={{ flex: 1 }}>
            <h3>{seller.name}</h3>
            <span className="muted small">{seller.city}</span>
          </div>
          <Link to={`/sellers/${seller.id}`} className="btn btn-outline btn-sm">
            View seller
          </Link>
        </div>
        <div className="card">
          <KV
            items={[
              ["Plan", `${plan.name} (${plan.lifetime ? "Lifetime" : plan.period})`],
              ["Quantity", p.qty],
              ["Total paid", <span className="num">{rupiah(p.amount)}</span>],
              ["Payment method", p.method],
              ["Payment", <Pill tone={pt}>{pl}</Pill>],
            ]}
          />
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          ...(p.codes ? [{ id: "codes" as const, label: "Codes", count: p.codes.length }] : []),
          { id: "activity", label: "Activity" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="card stack-sm">
          <h3>Delivery</h3>
          <p className="muted">
            {p.codes
              ? "Your codes were published to this page right after payment. Each code's VIP days start when it is redeemed."
              : p.delivery === "activated"
                ? "VIP was added to your account right after payment, after any time you already had."
                : "Delivery starts as soon as the payment is confirmed."}
          </p>
        </div>
      )}

      {tab === "codes" && p.codes && (
        <div className="card stack">
          <div className="row-between">
            <div>
              <h3>Your codes</h3>
              <p className="muted small">Your codes are always here, even if the email has not arrived.</p>
            </div>
            <Link to="/redeem" className="btn btn-outline btn-sm">
              Redeem a code <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {p.codes.map((c, i) => {
                  const [t, l] = codeStatus[c.status];
                  return (
                    <tr key={c.masked}>
                      <td className="num">{i + 1}</td>
                      <td className="num" style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                        {c.masked}
                      </td>
                      <td>
                        <Pill tone={t}>{l}</Pill>
                      </td>
                      <td>
                        {c.status === "ready" && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={async () => {
                              const ok = await copyText(c.masked);
                              setCopied(ok ? c.masked : "");
                            }}
                          >
                            <Icon name="copy" size={14} /> {copied === c.masked ? "Copied" : "Copy"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <span className="hint">Sample codes are masked. Real codes are revealed one at a time, and each reveal is recorded.</span>
        </div>
      )}

      {tab === "activity" && (
        <div className="card stack-sm">
          {[
            [p.at, "Order created and confirmed"],
            [p.at, `Payment ${p.payment === "paid" ? "confirmed" : "being checked"} (${p.method})`],
            ...(p.payment === "paid" ? [[p.at, p.codes ? "Codes published to My Purchases and emailed" : "VIP added to your account"]] : []),
          ].map(([t, txt], i) => (
            <div key={i} className="row" style={{ alignItems: "flex-start" }}>
              <span className="pill pill-primary" style={{ minWidth: 8, padding: 4 }} />
              <div>
                <b className="small">{txt}</b>
                <div className="muted small">{dateTime(t!)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {refund && (
        <Modal title="Request refund" onClose={() => { setRefund(false); setSent(false); }}>
          {sent ? (
            <>
              <Notice tone="success">Request sent. Nahj Finance will review it; nothing changes until they approve.</Notice>
              <button className="btn btn-primary" onClick={() => { setRefund(false); setSent(false); }}>
                Done
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="refund-units">What do you want to refund?</label>
                <select id="refund-units" className="select">
                  {p.codes ? (
                    <option>{unused.length} unused code{unused.length === 1 ? "" : "s"}</option>
                  ) : (
                    <option>This activation (within 48 hours of activation)</option>
                  )}
                </select>
                <span className="hint">{p.codes ? "Unused codes can be refunded within 30 days after payment." : "A used pass can be refunded within 48 hours after activation."}</span>
              </div>
              <div className="field">
                <label htmlFor="refund-reason">Reason</label>
                <select id="refund-reason" className="select">
                  <option>Change of plan</option>
                  <option>Bought by mistake</option>
                  <option>Other</option>
                </select>
              </div>
              {p.method !== "QRIS" && <Notice>Bank transfers are refunded to an account you choose. Finance will ask for it.</Notice>}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setRefund(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => setSent(true)}>
                  Submit request
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
