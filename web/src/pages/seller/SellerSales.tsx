import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { copyText, KV, Notice, Pill, Qty, SampleBadge, Tabs } from "../../components/ui";
import { PLANS, planBy, SELLER_ORDERS, sellerOrderPill } from "../../data/sample";
import { dateTime, rupiah } from "../../lib/format";

// U13 Create Sale.
export function CreateSale() {
  const [plan, setPlan] = useState("monthly");
  const [qty, setQty] = useState(1);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = planBy(plan);
  const link = "https://nahj.ryam.app/r/Kx7Pq2Lm9Vd4";

  return (
    <div className="seller-page">
      <div className="stack-sm">
        <h1>Create a Sale Request</h1>
        <p className="muted">Choose a plan and get a secure payment link for your customer.</p>
        <SampleBadge step="step 3" />
      </div>
      {!created ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="sale-plan">Plan</label>
            <select id="sale-plan" className="select" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLANS.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name} · {rupiah(x.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quantity</label>
            <Qty value={qty} onChange={setQty} />
          </div>
          <Notice>The customer chooses "Activate my account" or "Receive codes" after signing in. More than 1 always gives codes.</Notice>
          <div className="card card-flat" style={{ background: "var(--surface-2)" }}>
            <span className="muted small">Total</span>
            <div className="num" style={{ fontSize: "1.6rem", fontWeight: 800 }}>
              {rupiah(p.price * qty)}
            </div>
            <span className="muted small">The customer pays Nahj securely. Your commission: {rupiah(Math.floor(p.price * qty * 0.1))} (sample rate 10%).</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setCreated(true)}>
            Create request
          </button>
        </div>
      ) : (
        <div className="card stack">
          <Notice tone="success">
            <b>Payment link ready.</b> Share it with your customer. It works once and expires in 7 days.
          </Notice>
          <div className="row" style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
            <span className="num small" style={{ flex: 1, overflowWrap: "anywhere" }}>
              {link}
            </span>
            <button className="icon-btn" aria-label="Copy link" onClick={async () => setCopied(await copyText(link))}>
              <Icon name="copy" />
            </button>
          </div>
          {copied && <span className="small" style={{ color: "var(--success)" }}>Link copied.</span>}
          <div className="row">
            <a className="btn btn-outline" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">
              <Icon name="share" /> Share on WhatsApp
            </a>
            <button className="btn btn-ghost" onClick={() => { setCreated(false); setCopied(false); }}>
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// U14 Seller Orders.
export function SellerOrders() {
  const [tab, setTab] = useState<"orders" | "customers">("orders");
  const [filter, setFilter] = useState<"all" | "paid" | "awaiting">("all");
  const rows = useMemo(
    () => SELLER_ORDERS.filter((o) => filter === "all" || (filter === "paid" ? o.status === "paid_fulfilled" : o.status === "awaiting_payment")),
    [filter],
  );
  return (
    <div className="seller-page">
      <div className="row-between">
        <h1>Orders</h1>
        <SampleBadge step="step 3" />
      </div>
      <Tabs tabs={[{ id: "orders", label: "Orders" }, { id: "customers", label: "Customers" }]} value={tab} onChange={setTab} />
      {tab === "orders" ? (
        <>
          <div className="row" style={{ gap: 6 }}>
            {(["all", "paid", "awaiting"] as const).map((f) => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "paid" ? "Paid" : "Awaiting payment"}
              </button>
            ))}
          </div>
          {rows.map((o) => {
            const [t, l] = sellerOrderPill[o.status];
            return (
              <div key={o.ref} className="card stack-sm">
                <div className="row-between">
                  <b className="num">{o.ref}</b>
                  <Pill tone={t}>{l}</Pill>
                </div>
                <span className="muted small">{o.customer}</span>
                <div className="row-between">
                  <span className="small">
                    {planBy(o.plan).name} × {o.qty}
                    {o.channel === "store" && <span className="muted"> · App store purchase</span>}
                  </span>
                  <b className="num">{rupiah(o.total)}</b>
                </div>
                {o.codes && (
                  <span className="muted small">
                    {o.qty} codes: {o.codes.redeemed} redeemed, {o.codes.unused} unused
                  </span>
                )}
                <Link to={`/seller/orders/${o.ref}`} className="btn btn-outline btn-sm" style={{ justifySelf: "end" }}>
                  View order
                </Link>
              </div>
            );
          })}
        </>
      ) : (
        <div className="card stack-sm">
          {["nur***@gmail.com", "rina***@gmail.com", "budi***@sekolah.id", "dewi***@gmail.com"].map((c, i) => (
            <div key={c} className="row-between" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <span className="small">{c}</span>
              <span className="muted small">{i === 2 ? "1 order · 10 codes" : "1 order"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// U15 Seller Order. Fulfillment is automatic at payment, so there is no
// Activate or Deliver button and no countdown. Sellers see code counts only.
export function SellerOrder() {
  const { ref = "" } = useParams();
  const o = SELLER_ORDERS.find((x) => x.ref === ref);
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  if (!o) return <div className="seller-page"><div className="empty">Order not found.</div></div>;
  const [t, l] = sellerOrderPill[o.status];
  return (
    <div className="seller-page">
      <Link to="/seller/orders" className="small">
        ← Orders
      </Link>
      <div className="row-between">
        <h1 className="num" style={{ fontSize: "1.3rem" }}>
          {o.ref}
        </h1>
        <Pill tone={t}>{l}</Pill>
      </div>
      {o.status === "paid_fulfilled" && (
        <Notice tone="success">
          Paid and fulfilled automatically. {o.codes ? "The customer's codes are in their My Purchases." : "VIP was added to the customer's account."}
        </Notice>
      )}
      {o.status === "awaiting_payment" && <Notice>Waiting for the customer to pay. The link expires in 2 days.</Notice>}
      <div className="card">
        <KV
          items={[
            ["Customer", o.customer],
            ["Plan", `${planBy(o.plan).name} × ${o.qty}`],
            ["Total", <span className="num">{rupiah(o.total)}</span>],
            ["Channel", o.channel === "store" ? "App store (agent code)" : "Web sale link"],
            ["Delivery", o.codes ? `${o.qty} codes` : "Direct activation"],
            ["Placed", dateTime(o.at)],
          ]}
        />
      </div>
      <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "activity", label: "Activity" }]} value={tab} onChange={setTab} />
      {tab === "overview" ? (
        <div className="card stack-sm">
          {o.codes ? (
            <>
              <h3>Codes</h3>
              <div className="row" style={{ gap: 24 }}>
                <div className="stat">
                  <span>Redeemed</span>
                  <b>{o.codes.redeemed}</b>
                </div>
                <div className="stat">
                  <span>Unused</span>
                  <b>{o.codes.unused}</b>
                </div>
              </div>
              <span className="hint">For privacy, you see how many codes were used, not the codes or who redeemed them.</span>
            </>
          ) : (
            <>
              <h3>Commission</h3>
              <p className="muted small">Your commission becomes available after the waiting period, if the order is not refunded.</p>
            </>
          )}
        </div>
      ) : (
        <div className="card stack-sm small">
          <span>{dateTime(o.at)} · Order created</span>
          {o.status === "paid_fulfilled" && <span>{dateTime(o.at)} · Payment confirmed, fulfilled automatically</span>}
        </div>
      )}
      <div className="row">
        <Link to="/seller/support" className="btn btn-outline">
          Help customer
        </Link>
      </div>
      <SampleBadge step="step 3" />
    </div>
  );
}
