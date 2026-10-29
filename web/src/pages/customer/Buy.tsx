import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Avatar, Choice, KV, Notice, PageHead, Pill, Qty, SampleBadge, Steps, Tile } from "../../components/ui";
import { PLANS, planBy, SELLERS, sellerBy } from "../../data/sample";
import { rupiah } from "../../lib/format";
import { accountLabel, useSession } from "../../lib/session";
import { SignedOutNote } from "../../shells/common";

type Method = "qris" | "va_bca" | "va_bni";
const METHODS: { id: Method; label: string; text: string }[] = [
  { id: "qris", label: "QRIS", text: "Scan with any bank or e-wallet app (GoPay, OVO, DANA, ShopeePay…)" },
  { id: "va_bca", label: "BCA Virtual Account", text: "Transfer from BCA mobile, KlikBCA or an ATM" },
  { id: "va_bni", label: "BNI Virtual Account", text: "Transfer from BNI Mobile Banking or an ATM" },
];

// U06 Buy Subscription: one step visible at a time.
export function Buy() {
  const [params] = useSearchParams();
  const seller = sellerBy(params.get("seller") ?? "") ?? SELLERS[3]!;
  const { session } = useSession();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(params.get("plan") ?? "monthly");
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"direct" | "codes">("direct");
  const [terms, setTerms] = useState(false);
  const [method, setMethod] = useState<Method>("qris");
  const [paying, setPaying] = useState(false);

  const p = planBy(plan);
  const total = p.price * qty;
  const effectiveMode = qty > 1 ? "codes" : mode;
  const account = session ? accountLabel(session) : "Nadia A. (sample)";

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHead title="Buy Subscription" badge={<SampleBadge step="step 3" />} />
      <SignedOutNote what="your account here" />
      <div className="card">
        <Steps
          current={step}
          steps={[
            { title: "Setup", text: "Plan and delivery" },
            { title: "Review", text: "Confirm your purchase" },
            { title: "Payment", text: "Pay Nahj securely" },
            { title: "Result", text: "Get your access" },
          ]}
        />
      </div>

      {step === 0 && (
        <div className="grid-2">
          <div className="card stack">
            <div className="row">
              <Tile name={seller.name} />
              <div>
                <span className="muted small">Seller</span>
                <h3>{seller.name}</h3>
                <span className="muted small">{seller.city}</span>
              </div>
            </div>
            <div className="stack-sm" role="radiogroup" aria-label="Plan">
              <h3>Plan</h3>
              {PLANS.map((x) => (
                <Choice key={x.code} id={`buy-plan-${x.code}`} checked={plan === x.code} onSelect={() => setPlan(x.code)}>
                  <div className="row-between">
                    <b>{x.name}</b>
                    <span className="num" style={{ fontWeight: 700 }}>
                      {rupiah(x.price)}
                    </span>
                  </div>
                  <span className="muted small">{x.lifetime ? "One-time, VIP for the life of your account" : `${x.period} of VIP`}</span>
                </Choice>
              ))}
            </div>
          </div>
          <div className="card stack">
            <div className="stack-sm">
              <h3>Quantity</h3>
              <Qty value={qty} max={100} onChange={setQty} />
              <span className="hint">Direct activation is only for quantity 1. More than 1 always gives codes.</span>
            </div>
            <div className="stack-sm" role="radiogroup" aria-label="Delivery">
              <h3>Delivery</h3>
              <Choice id="mode-direct" checked={effectiveMode === "direct"} disabled={qty > 1} onSelect={() => setMode("direct")}>
                <b>Activate my account</b>
                <div className="muted small">VIP is added to your account right after payment.</div>
              </Choice>
              <Choice id="mode-codes" checked={effectiveMode === "codes"} onSelect={() => setMode("codes")}>
                <b>Receive codes</b>
                <div className="muted small">Codes appear in My Purchases right after payment, to give or use later.</div>
              </Choice>
            </div>
            <div className="stack-sm">
              <h3>Your account</h3>
              <div className="row" style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}>
                <Avatar name={account} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{account}</b>
                  <div className="muted small">The purchase is linked to this account.</div>
                </div>
                <Pill tone={session ? "success" : "neutral"}>
                  <Icon name="lock" size={14} /> {session ? "Signed in" : "Sample"}
                </Pill>
              </div>
            </div>
            <div className="row-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <span className="muted">Total</span>
              <b className="num" style={{ fontSize: "1.3rem" }}>
                {rupiah(total)}
              </b>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>
              Continue to review <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card stack" style={{ maxWidth: 620 }}>
          <h2>Review your purchase</h2>
          <KV
            items={[
              ["Seller", seller.name],
              ["Plan", `${p.name} (${p.lifetime ? "Lifetime" : p.period})`],
              ["Quantity", qty],
              ["Delivery", effectiveMode === "direct" ? "Activate my account" : `${qty} code${qty > 1 ? "s" : ""}`],
              ["Account", account],
              ["Total", <span className="num">{rupiah(total)}</span>],
            ]}
          />
          <Notice>One payment. This purchase does not renew automatically. Refunds: within 48 hours after activation, or within 30 days for unused codes.</Notice>
          <label className="row" style={{ alignItems: "flex-start", cursor: "pointer" }}>
            <input id="terms" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 4 }} />
            <span className="small">
              I agree to the <Link to="/help?tab=policies">Terms</Link> and <Link to="/help?tab=policies">Refund Policy</Link>.
            </span>
          </label>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!terms} onClick={() => setStep(2)}>
              Confirm and pay <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid-2">
          <div className="card stack" role="radiogroup" aria-label="Payment method">
            <h2>Choose how to pay</h2>
            {METHODS.map((m) => (
              <Choice key={m.id} id={`pay-${m.id}`} checked={method === m.id} onSelect={() => setMethod(m.id)}>
                <b>{m.label}</b>
                <div className="muted small">{m.text}</div>
              </Choice>
            ))}
            <span className="hint">You pay Nahj directly. Never pay a seller outside this page.</span>
          </div>
          <div className="card stack" style={{ justifyItems: "center", textAlign: "center" }}>
            <h3>{method === "qris" ? "Scan to pay" : "Transfer to this virtual account"}</h3>
            {method === "qris" ? (
              <div aria-label="Sample QR code" style={{ width: 200, height: 200, borderRadius: 12, background: "repeating-conic-gradient(#1b1a3a 0 25%, #fff 0 50%) 0 0/20px 20px", border: "8px solid #fff", boxShadow: "0 0 0 1px var(--line)" }} />
            ) : (
              <div className="stack-sm">
                <span className="muted small">{method === "va_bca" ? "BCA" : "BNI"} virtual account number</span>
                <b className="num" style={{ fontSize: "1.5rem", letterSpacing: "0.06em" }}>
                  8808 1234 5678 9012
                </b>
              </div>
            )}
            <b className="num" style={{ fontSize: "1.3rem" }}>
              {rupiah(total)}
            </b>
            <span className="muted small">Pay within 30 minutes. This page updates when Nahj confirms the payment.</span>
            <button
              className="btn btn-primary btn-block"
              disabled={paying}
              onClick={() => {
                setPaying(true);
                setTimeout(() => {
                  setPaying(false);
                  setStep(3);
                }, 1200);
              }}
            >
              {paying ? "Checking payment…" : "Simulate payment (sample)"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card stack" style={{ maxWidth: 620, justifyItems: "start" }}>
          <Pill tone="success">
            <Icon name="check" size={14} /> Paid
          </Pill>
          <h2>{effectiveMode === "direct" ? "VIP is active on your account" : `Your ${qty} code${qty > 1 ? "s are" : " is"} ready`}</h2>
          <p className="muted">
            {effectiveMode === "direct"
              ? `${p.name} VIP was added to ${account}, after any time you already have. Sign in to the Nahj app with this account.`
              : "Find them in My Purchases. We also emailed you a link. Each code's days start when it is redeemed."}
          </p>
          <div className="row">
            <Link to="/purchases/NHO-261021-Q4R8" className="btn btn-primary">
              View purchase
            </Link>
            <Link to={effectiveMode === "direct" ? "/account" : "/redeem"} className="btn btn-outline">
              {effectiveMode === "direct" ? "My subscription" : "Redeem a code"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
