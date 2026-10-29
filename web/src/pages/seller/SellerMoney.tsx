import { useState } from "react";
import { Choice, copyText, KV, Modal, Notice, Pill, SampleBadge, Tabs } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { EARNINGS, planBy, REFERRED, WALLET } from "../../data/sample";
import { date, rupiah } from "../../lib/format";

const FEE = 2500;

// U16 Wallet.
export function SellerWallet() {
  const [tab, setTab] = useState<"earnings" | "withdrawals" | "payout">("earnings");
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState(1000000);
  const [dest, setDest] = useState("bca");
  const [done, setDone] = useState(false);
  const tooSmall = amount < 500000;
  const tooBig = amount > WALLET.available;

  return (
    <div className="seller-page">
      <div className="row-between">
        <div>
          <h1>Wallet</h1>
          <p className="muted small">Your earnings from Nahj sales</p>
        </div>
        <SampleBadge step="step 5" />
      </div>
      <div className="card stack">
        <div className="stat">
          <span>Available</span>
          <b className="num" style={{ fontSize: "1.8rem" }}>
            {rupiah(WALLET.available)}
          </b>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <div className="stat">
            <span>Pending</span>
            <b className="num" style={{ fontSize: "1rem" }}>
              {rupiah(WALLET.pending)}
            </b>
          </div>
          <div className="stat">
            <span>On hold</span>
            <b className="num" style={{ fontSize: "1rem" }}>
              {rupiah(WALLET.held)}
            </b>
          </div>
          <div className="stat">
            <span>Withdrawn</span>
            <b className="num" style={{ fontSize: "1rem" }}>
              {rupiah(WALLET.withdrawn)}
            </b>
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => { setSheet(true); setDone(false); }}>
          Withdraw funds
        </button>
      </div>
      <Tabs tabs={[{ id: "earnings", label: "Earnings" }, { id: "withdrawals", label: "Withdrawals" }, { id: "payout", label: "Payout details" }]} value={tab} onChange={setTab} />
      {tab === "earnings" && (
        <div className="card stack-sm">
          {EARNINGS.map((e) => (
            <div key={e.ref} className="row-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <b className="small num">{e.ref}</b>
                <div className="muted small">
                  {date(e.at)} · {planBy(e.plan).name} · {e.release}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <b className="num" style={{ color: "var(--success)" }}>
                  + {rupiah(e.amount)}
                </b>
                <div>
                  <Pill tone={e.state === "Available" ? "success" : "warning"}>{e.state}</Pill>
                </div>
              </div>
            </div>
          ))}
          <span className="hint">Web sales: available 7 days after payment. Codes: also after the code is redeemed or its 30-day refund period ends. App-store sales: after the store's hold.</span>
        </div>
      )}
      {tab === "withdrawals" && (
        <div className="card stack-sm">
          <div className="row-between">
            <div>
              <b className="num small">WD-261020-001</b>
              <div className="muted small">20 Oct 2026 · BCA ****1234</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <b className="num">{rupiah(780000)}</b>
              <div>
                <Pill tone="success">Paid</Pill>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "payout" && (
        <div className="card stack">
          <KV items={[["Bank account", "BCA ****1234 · Verified"], ["E-wallet", "DANA ****5678 · Verified"]]} />
          <span className="hint">Changing a payout account needs a fresh sign-in, notifies your old email, and pauses withdrawals for a while.</span>
        </div>
      )}

      {sheet && (
        <Modal title="Confirm withdrawal" onClose={() => setSheet(false)}>
          {done ? (
            <>
              <Notice tone="success">Withdrawal requested. The amount is locked and Nahj Finance will process it.</Notice>
              <button className="btn btn-primary" onClick={() => setSheet(false)}>
                Done
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="wd-amount">Amount (IDR)</label>
                <input id="wd-amount" className="input num" type="number" min={500000} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                {tooSmall && <span className="small" style={{ color: "var(--danger)" }}>The minimum is {rupiah(500000)}.</span>}
                {tooBig && <span className="small" style={{ color: "var(--danger)" }}>More than your available balance.</span>}
              </div>
              <KV
                items={[
                  ["Fee", rupiah(FEE)],
                  ["You will receive", <b className="num">{rupiah(Math.max(0, amount - FEE))}</b>],
                ]}
              />
              <div className="stack-sm" role="radiogroup" aria-label="Payout account">
                <Choice id="dest-bca" checked={dest === "bca"} onSelect={() => setDest("bca")}>
                  <b>Bank account · BCA ****1234</b>
                </Choice>
                <Choice id="dest-dana" checked={dest === "dana"} onSelect={() => setDest("dana")}>
                  <b>E-wallet · DANA ****5678</b>
                </Choice>
              </div>
              <Notice>You will confirm with your two-step sign-in (TOTP) before the request is sent.</Notice>
              <button className="btn btn-primary" disabled={tooSmall || tooBig} onClick={() => setDone(true)}>
                <Icon name="lock" /> Confirm withdrawal
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// U17 Seller Referrals.
export function SellerReferrals() {
  const [copied, setCopied] = useState(false);
  const link = "https://nahj.ryam.app/join/AB12C";
  return (
    <div className="seller-page">
      <div className="row-between">
        <div>
          <h1>Referrals</h1>
          <p className="muted small">Invite new sellers and grow together</p>
        </div>
        <SampleBadge step="step 7" />
      </div>
      <div className="card stack">
        <h3>Invite a seller</h3>
        <div className="row" style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
          <span className="num small" style={{ flex: 1 }}>
            {link}
          </span>
          <button className="btn btn-outline btn-sm" onClick={async () => setCopied(await copyText(link))}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <span className="hint">You earn a reward on a referred seller's sales in every month they reach the target. One level only.</span>
      </div>
      <div className="card stack">
        <h3>October 2026 progress</h3>
        {REFERRED.map((r) => {
          const pct = Math.min(100, Math.round((r.sales / r.target) * 100));
          return (
            <div key={r.name} className="stack-sm">
              <div className="row-between">
                <b className="small">{r.name}</b>
                <Pill tone={r.state === "Target reached" ? "success" : "warning"}>{r.state}</Pill>
              </div>
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="muted small num">
                {rupiah(r.sales)} of {rupiah(r.target)} · joined {date(r.joined)}
              </span>
            </div>
          );
        })}
        <span className="hint">Rewards stay provisional until the month closes (Jakarta time).</span>
      </div>
    </div>
  );
}
