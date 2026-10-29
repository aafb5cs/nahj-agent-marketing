import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Choice, Pill, SampleBadge, Tabs, Tile } from "../../components/ui";
import { PLANS, sellerBy } from "../../data/sample";
import { rupiah } from "../../lib/format";

export function SellerProfile() {
  const { id = "" } = useParams();
  const seller = sellerBy(id);
  const nav = useNavigate();
  const [tab, setTab] = useState<"plans" | "about">("plans");
  const [plan, setPlan] = useState("yearly");
  if (!seller) return <div className="page"><div className="empty">This seller does not exist or is no longer listed.</div></div>;

  return (
    <div className="page">
      <Link to="/sellers" className="small">
        ← Back to sellers
      </Link>
      <div className="card row" style={{ alignItems: "flex-start", gap: 20 }}>
        <Tile name={seller.name} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <div className="row">
            <h1>{seller.name}</h1>
            <Pill tone="success">
              <Icon name="check" size={14} /> Approved seller
            </Pill>
            <SampleBadge step="step 2" />
          </div>
          <span className="muted row" style={{ gap: 6 }}>
            <Icon name="pin" size={16} /> {seller.city} · serves all of Indonesia
          </span>
          <p className="muted">{seller.about}</p>
        </div>
      </div>
      <Tabs tabs={[{ id: "plans", label: "Plans" }, { id: "about", label: "About" }]} value={tab} onChange={setTab} />
      {tab === "plans" ? (
        <div className="stack">
          <div>
            <h2>Choose your plan</h2>
            <p className="muted small">Every pass is prepaid and does not renew automatically. New time is added after your current VIP ends.</p>
          </div>
          <div className="grid-3" role="radiogroup" aria-label="Plan">
            {PLANS.map((p) => (
              <Choice key={p.code} id={`plan-${p.code}`} checked={plan === p.code} onSelect={() => setPlan(p.code)}>
                <div className="row-between">
                  <b>{p.name}</b>
                  {p.popular && <Pill tone="primary">Most popular</Pill>}
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800 }} className="num">
                  {rupiah(p.price)}
                </div>
                <div className="muted small">{p.lifetime ? "One-time · VIP for the life of your account" : `${p.period} of VIP`}</div>
                <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                  {p.perks.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Choice>
            ))}
          </div>
          <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => nav(`/buy?seller=${seller.id}&plan=${plan}`)}>
            Buy Subscription <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <div className="card stack-sm">
          <h3>About {seller.name}</h3>
          <p className="muted">{seller.about} Payments go to Nahj; the seller never asks you to pay them directly.</p>
        </div>
      )}
    </div>
  );
}
