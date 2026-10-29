import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { PageHead, SampleBadge, Tile } from "../../components/ui";
import { CITIES, SELLERS } from "../../data/sample";

export function FindSeller() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const list = useMemo(
    () => SELLERS.filter((s) => (!city || s.city === city) && (!q || s.name.toLowerCase().includes(q.toLowerCase()))),
    [q, city],
  );
  return (
    <div className="page">
      <PageHead title="Find a Seller" subtitle="Sellers can help customers anywhere in Indonesia." badge={<SampleBadge step="step 2" />} />
      <div className="card toolbar">
        <input id="seller-search" className="input" placeholder="Search seller name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search seller name" />
        <select id="seller-city" className="select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
          <option value="">All cities</option>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {(q || city) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setCity(""); }}>
            Clear filters
          </button>
        )}
      </div>
      <p className="muted small">{list.length} sellers found</p>
      {list.length === 0 ? (
        <div className="empty">No seller matches. Try another name or city.</div>
      ) : (
        <div className="grid-3">
          {list.map((s) => (
            <div key={s.id} className="card stack">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <Tile name={s.name} />
                <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <h3>{s.name}</h3>
                  <span className="muted small row" style={{ gap: 4 }}>
                    <Icon name="pin" size={14} /> {s.city}
                  </span>
                </div>
              </div>
              <p className="muted small">{s.about}</p>
              <Link to={`/sellers/${s.id}`} className="btn btn-outline btn-sm">
                View Seller <Icon name="arrow" size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
