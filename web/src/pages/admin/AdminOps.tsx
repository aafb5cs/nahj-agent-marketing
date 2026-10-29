import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Drawer, KV, Notice, PageHead, Pill, SampleBadge, Tabs } from "../../components/ui";
import { ADMIN_ORDERS, APPLICATIONS, ATTENTION, CUSTOMERS, SELLERS } from "../../data/sample";
import { date, dateTime, rupiah } from "../../lib/format";
import { accountLabel, useSession } from "../../lib/session";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  return h < 11 ? "Good morning" : h < 15 ? "Good afternoon" : "Good evening";
}

// U20 Admin Home.
export function AdminHome() {
  const { session } = useSession();
  const [tab, setTab] = useState<"attention" | "operations">("attention");
  return (
    <div className="admin-page">
      <PageHead
        title={`${greeting()}${session ? ", " + accountLabel(session) : ""}`}
        subtitle="Here's what needs your attention today."
        badge={<SampleBadge step="steps 3–8" />}
      />
      <Tabs tabs={[{ id: "attention", label: "Needs attention", count: ATTENTION.length }, { id: "operations", label: "Operations", count: 3 }]} value={tab} onChange={setTab} />
      {tab === "attention" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Related to</th>
                <th>Age</th>
                <th>Owner</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ATTENTION.map((a) => (
                <tr key={a.issue + a.related}>
                  <td style={{ fontWeight: 600 }}>{a.issue}</td>
                  <td className="small">{a.related}</td>
                  <td className="num">{a.age}</td>
                  <td>{a.owner}</td>
                  <td>
                    <Pill tone={a.status[0]}>{a.status[1]}</Pill>
                  </td>
                  <td>
                    <Link to={a.to} className="btn btn-outline btn-sm">
                      {a.action}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid-3">
          {[
            ["Unresolved payments", "1", "Oldest 2h"],
            ["Fulfillment recovery", "1", "Retrying, nahj_backend slow"],
            ["Jobs queue", "0 failed", "Worker healthy"],
          ].map(([t, v, s]) => (
            <div key={t} className="card stat">
              <span>{t}</span>
              <b>{v}</b>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// U21 Admin Sellers.
export function AdminSellers() {
  const [tab, setTab] = useState<"sellers" | "applications">("applications");
  const [open, setOpen] = useState<string | null>(null);
  const app = APPLICATIONS.find((a) => a.ref === open);
  return (
    <div className="admin-page">
      <PageHead title="Sellers" badge={<SampleBadge step="step 2" />} />
      <Tabs tabs={[{ id: "sellers", label: "Sellers", count: SELLERS.length }, { id: "applications", label: "Applications", count: APPLICATIONS.length }]} value={tab} onChange={setTab} />
      {tab === "applications" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>City</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {APPLICATIONS.map((a) => (
                <tr key={a.ref} className={`clickable ${open === a.ref ? "selected" : ""}`} onClick={() => setOpen(a.ref)}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={a.name} size={32} />
                      <div>
                        <b>{a.name}</b>
                        <div className="muted small num">{a.ref}</div>
                      </div>
                    </div>
                  </td>
                  <td>{a.city}</td>
                  <td>{date(a.applied)}</td>
                  <td>
                    <Pill tone={a.status[0]}>{a.status[1]}</Pill>
                  </td>
                  <td>{a.reviewer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Seller</th>
                <th>City</th>
                <th>Type</th>
                <th>Agent code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SELLERS.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.city}</td>
                  <td>{i === 4 ? <Pill tone="primary">Employee · 0%</Pill> : <Pill>Partner</Pill>}</td>
                  <td className="num">{s.agentCode}</td>
                  <td>{i === 5 ? <Pill tone="warning">Paused</Pill> : <Pill tone="success">Active</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {app && (
        <Drawer
          title={app.name}
          subtitle={`${app.ref} · applied ${date(app.applied)}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn btn-outline">Request information</button>
              <button className="btn btn-primary">Approve seller</button>
              <button className="btn btn-danger">Reject</button>
            </>
          }
        >
          <Pill tone={app.status[0]}>{app.status[1]}</Pill>
          <KV items={[["City", app.city], ["Phone", app.phone], ["Reviewer", app.reviewer], ["About", app.about]]} />
          <Notice>Approval starts onboarding. The seller can sell after setting up two-step sign-in and accepting the seller terms.</Notice>
        </Drawer>
      )}
    </div>
  );
}

// U22 Admin Orders.
export function AdminOrders() {
  const [tab, setTab] = useState<"all" | "payment" | "refunds">("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () => ADMIN_ORDERS.filter((o) => tab === "all" || (tab === "payment" ? o.payment[0] === "warning" : o.refund !== "None")),
    [tab],
  );
  const o = ADMIN_ORDERS.find((x) => x.ref === open);
  return (
    <div className="admin-page">
      <PageHead title="Orders" badge={<SampleBadge step="step 3" />} />
      <Tabs
        tabs={[
          { id: "all", label: "All orders" },
          { id: "payment", label: "Payment issues", count: ADMIN_ORDERS.filter((x) => x.payment[0] === "warning").length },
          { id: "refunds", label: "Refunds", count: ADMIN_ORDERS.filter((x) => x.refund !== "None").length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="toolbar">
        <input id="order-search" className="input" placeholder="Search order, customer or seller" aria-label="Search orders" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Channel</th>
              <th>Customer</th>
              <th>Seller</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.ref} className={`clickable ${open === x.ref ? "selected" : ""}`} onClick={() => setOpen(x.ref)}>
                <td className="num" style={{ fontWeight: 600 }}>
                  {x.ref}
                </td>
                <td>{x.channel === "store" ? <Pill tone="primary">App store</Pill> : <Pill>Web</Pill>}</td>
                <td>{x.customer}</td>
                <td>{x.seller}</td>
                <td>{date(x.at)}</td>
                <td className="num">{rupiah(x.total)}</td>
                <td>
                  <Pill tone={x.payment[0]}>{x.payment[1]}</Pill>
                </td>
                <td>
                  <Pill tone={x.fulfillment[0]}>{x.fulfillment[1]}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {o && (
        <Drawer
          title={`Order ${o.ref}`}
          subtitle={`Placed ${dateTime(o.at)}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn btn-primary">Check payment</button>
              {o.refund !== "None" && <button className="btn btn-outline">Review refund</button>}
            </>
          }
        >
          <KV
            items={[
              ["Customer", o.customer],
              ["Seller", o.seller],
              ["Channel", o.channel === "store" ? "App store (agent code)" : "Web"],
              ["Total", rupiah(o.total)],
              ["Payment", <Pill tone={o.payment[0]}>{o.payment[1]}</Pill>],
              ["Fulfillment", <Pill tone={o.fulfillment[0]}>{o.fulfillment[1]}</Pill>],
              ["Refund", o.refund],
            ]}
          />
          {o.payment[0] === "warning" && <Notice tone="warning">The provider has not confirmed this payment. Check the original transaction before offering the customer another attempt.</Notice>}
        </Drawer>
      )}
    </div>
  );
}

// U23 Admin Customers.
export function AdminCustomers() {
  const [open, setOpen] = useState<string | null>(null);
  const c = CUSTOMERS.find((x) => x.email === open);
  return (
    <div className="admin-page">
      <PageHead title="Customers" badge={<SampleBadge step="step 3" />} />
      <div className="toolbar">
        <input id="customer-search" className="input" placeholder="Search by name, email or reference" aria-label="Search customers" />
        <span className="hint">Searching by email records the reason in the audit log.</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>VIP</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((x) => (
              <tr key={x.email} className={`clickable ${open === x.email ? "selected" : ""}`} onClick={() => setOpen(x.email)}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={x.name} size={30} /> <b>{x.name}</b>
                  </div>
                </td>
                <td>{x.email}</td>
                <td className="small">{x.vip}</td>
                <td>
                  <Pill tone="success">{x.status}</Pill>
                </td>
                <td>{date(x.joined)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c && (
        <Drawer
          title={c.name}
          subtitle={`Customer · joined ${date(c.joined)}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn btn-primary">Refresh account access</button>
              <button className="btn btn-outline">Open support case</button>
            </>
          }
        >
          <KV items={[["Email", c.email], ["VIP", c.vip], ["Status", c.status]]} />
          <div className="card card-flat stack-sm">
            <h3>Notes</h3>
            <p className="muted small">No internal notes. Notes are visible to authorised staff only.</p>
          </div>
        </Drawer>
      )}
    </div>
  );
}
