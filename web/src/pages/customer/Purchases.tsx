import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { PageHead, Pill, SampleBadge } from "../../components/ui";
import { deliveryPill, paymentPill, planBy, PURCHASES, sellerBy } from "../../data/sample";
import { date, rupiah } from "../../lib/format";
import { SignedOutNote } from "../../shells/common";

export function Purchases() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const rows = useMemo(() => PURCHASES.filter((p) => (!q || p.ref.toLowerCase().includes(q.toLowerCase())) && (!status || p.payment === status)), [q, status]);

  return (
    <div className="page">
      <PageHead
        title="My Purchases"
        subtitle="Your orders, payments and codes."
        badge={<SampleBadge step="step 3" />}
        actions={
          <Link to="/sellers" className="btn btn-primary">
            Buy Subscription <Icon name="arrow" />
          </Link>
        }
      />
      <SignedOutNote what="your purchases" />
      <div className="toolbar">
        <input id="purchase-search" className="input" placeholder="Search order reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search order reference" />
        <select id="purchase-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status">
          <option value="">All payment status</option>
          <option value="paid">Paid</option>
          <option value="checking">Checking</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Seller</th>
              <th>Plan</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Delivery</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const [pt, pl] = paymentPill[p.payment];
              const [dt, dl] = deliveryPill[p.delivery];
              return (
                <tr key={p.ref} className="clickable" onClick={() => nav(`/purchases/${p.ref}`)}>
                  <td className="num" style={{ fontWeight: 600 }}>
                    <Link to={`/purchases/${p.ref}`} onClick={(e) => e.stopPropagation()}>
                      {p.ref}
                    </Link>
                  </td>
                  <td>{sellerBy(p.sellerId)?.name}</td>
                  <td>{planBy(p.plan).name}</td>
                  <td className="num">{p.qty}</td>
                  <td className="num">{rupiah(p.amount)}</td>
                  <td>
                    <Pill tone={pt}>{pl}</Pill>
                  </td>
                  <td>
                    <Pill tone={dt}>{dl}</Pill>
                  </td>
                  <td>{date(p.at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="empty">No purchase matches.</div>}
      <p className="muted small">
        Showing {rows.length} of {PURCHASES.length} purchases
      </p>
    </div>
  );
}
