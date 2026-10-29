import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";

const ACTIONS = [
  { icon: "bag", title: "Buy Subscription", text: "Get Nahj VIP for your child through a trusted seller.", to: "/sellers", cta: "Find a seller" },
  { icon: "ticket", title: "Redeem Code", text: "Have a code? Add its VIP time to your Nahj account.", to: "/redeem", cta: "Redeem code" },
  { icon: "list", title: "My Purchases", text: "See your orders, codes and payment status.", to: "/purchases", cta: "My purchases" },
  { icon: "store", title: "Find a Seller", text: "Sellers serve customers across Indonesia.", to: "/sellers", cta: "Browse sellers" },
];

export function Home() {
  return (
    <div className="page">
      <section className="hero">
        <div className="stack">
          <span className="pill pill-primary" style={{ justifySelf: "start" }}>
            Nahj app by PT. RYAM TECHNOLOGY SOLUTIONS
          </span>
          <h1>Learn with Nahj, a structured learning journey for young minds.</h1>
          <p className="muted" style={{ fontSize: "1.05rem", maxWidth: "54ch" }}>
            Children learn through lessons, interactive activities and a clear path of progress. Buy VIP from a seller you trust and pay Nahj securely with QRIS or bank transfer.
          </p>
          <div className="row">
            <Link to="/sellers" className="btn btn-primary">
              Buy Subscription <Icon name="arrow" />
            </Link>
            <Link to="/redeem" className="btn btn-outline">
              Redeem a Code
            </Link>
          </div>
        </div>
        <div className="hero-art">
          Play · Learn · Grow
          <br />
          <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>Small steps, bright tomorrows</span>
        </div>
      </section>

      <section className="grid-4" aria-label="What you can do">
        {ACTIONS.map((a) => (
          <Link key={a.title} to={a.to} className="card" style={{ color: "inherit", textDecoration: "none", display: "grid", gap: 10 }}>
            <span className="tile" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 44, height: 44, borderRadius: 12 }}>
              <Icon name={a.icon} size={22} />
            </span>
            <h3>{a.title}</h3>
            <p className="muted small">{a.text}</p>
            <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.9rem" }}>
              {a.cta} →
            </span>
          </Link>
        ))}
      </section>

      <section className="card grid-2" style={{ alignItems: "center" }}>
        <div className="stack-sm">
          <h2>Want to sell Nahj?</h2>
          <p className="muted">Teachers, shops and communities can apply to become a seller. Share a link, the customer pays Nahj, and you earn commission.</p>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Link to="/seller/apply" className="btn btn-outline">
            Become a Seller
          </Link>
        </div>
      </section>
    </div>
  );
}
