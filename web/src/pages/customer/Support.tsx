import { useState } from "react";
import { Icon } from "../../components/Icon";
import { PageHead, Pill, SampleBadge } from "../../components/ui";
import { SignedOutNote } from "../../shells/common";

const THREADS = [
  { id: "t1", title: "Access not working", ref: "#CS-261029-001", when: "10:24", status: "Open", messages: [
    { me: false, who: "Nahj Support", text: "Hello! How can we help with your Nahj access?" },
    { me: true, who: "You", text: "I redeemed a code but the content is still locked on my tablet." },
    { me: false, who: "Nahj Support", text: "Thanks, we're checking your account. Which device do you use?" },
  ] },
  { id: "t2", title: "Redeem code help", ref: "#CS-261026-004", when: "26 Oct", status: "Resolved", messages: [{ me: true, who: "You", text: "Where do I type the code?" }] },
  { id: "t3", title: "App installation", ref: "#CS-261020-002", when: "20 Oct", status: "Resolved", messages: [{ me: true, who: "You", text: "Which app do I install?" }] },
];

// U10 Customer Support.
export function Support() {
  const [active, setActive] = useState(THREADS[0]!.id);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const t = THREADS.find((x) => x.id === active)!;
  return (
    <div className="page">
      <PageHead title="Customer Support" subtitle="Message your seller or the Nahj team." badge={<SampleBadge step="step 8" />} actions={<button className="btn btn-primary">+ New request</button>} />
      <SignedOutNote what="your conversations" />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 16 }} className="support-grid">
        <div className="card stack-sm" style={{ padding: 10, alignSelf: "start" }}>
          {THREADS.map((x) => (
            <button key={x.id} className="list-item" aria-current={x.id === active} onClick={() => { setActive(x.id); setExtra([]); }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">{x.title}</b>
                <div className="muted small">{x.ref}</div>
              </div>
              <span className="muted small">{x.when}</span>
            </button>
          ))}
        </div>
        <div className="card stack">
          <div className="row-between">
            <div>
              <h3>{t.title}</h3>
              <span className="muted small">{t.ref}</span>
            </div>
            <Pill tone={t.status === "Open" ? "info" : "success"}>{t.status}</Pill>
          </div>
          <div className="thread">
            {t.messages.map((m, i) => (
              <div key={i} className={`bubble ${m.me ? "me" : ""}`}>
                <b>{m.who}</b>
                {m.text}
              </div>
            ))}
            {extra.map((m, i) => (
              <div key={`x${i}`} className="bubble me">
                <b>You</b>
                {m}
              </div>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) {
                setExtra((x) => [...x, draft.trim()]);
                setDraft("");
              }
            }}
          >
            <input id="support-message" className="input" style={{ flex: 1 }} placeholder="Type your message…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Message" />
            <button className="btn btn-primary" type="submit">
              Send <Icon name="arrow" size={16} />
            </button>
          </form>
          <span className="hint">You can attach images (PNG, JPG) up to 5 MB.</span>
        </div>
      </div>
      <style>{`@media (max-width: 760px){.support-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
