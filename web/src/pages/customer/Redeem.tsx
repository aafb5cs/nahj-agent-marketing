import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { KV, Notice, PageHead, Pill, SampleBadge, Steps } from "../../components/ui";
import { accountLabel, useSession } from "../../lib/session";
import { SignedOutNote } from "../../shells/common";

// U27 Redeem Code. Checking reserves nothing; Confirm consumes the code.
export function Redeem() {
  const { session } = useSession();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const account = session ? accountLabel(session) : "Aisyah Rahma (sample)";

  const check = () => {
    const c = code.trim().toUpperCase();
    if (!/^NHJ-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) {
      setError("That does not look like a Nahj code. Codes look like NHJ-XXXX-XXXX-XXXX.");
      return;
    }
    if (c.endsWith("USED")) {
      setError("This code has already been used.");
      return;
    }
    setError("");
    setStep(1);
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHead title="Redeem Code" subtitle="Add a code's VIP time to your Nahj account." badge={<SampleBadge step="step 4" />} />
      <SignedOutNote what="your account" />
      <div className="card">
        <Steps current={step} steps={[{ title: "Enter code" }, { title: "Review" }, { title: "Done" }]} />
      </div>

      {step === 0 && (
        <div className="card stack">
          <div className="row-between">
            <span className="muted small">
              Redeeming on <b style={{ color: "var(--ink)" }}>{account}</b>
            </span>
            <button className="btn btn-ghost btn-sm">Switch account</button>
          </div>
          <div className="field">
            <label htmlFor="code">Activation code</label>
            <input id="code" className="input num" placeholder="NHJ-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} style={{ fontSize: "1.1rem", letterSpacing: "0.05em" }} />
            {error ? <span className="small" style={{ color: "var(--danger)" }}>{error}</span> : <span className="hint">Try NHJ-7K2M-9D4F-2A1C in this preview.</span>}
          </div>
          <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={check}>
            Check code <Icon name="arrow" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card stack">
          <h2>Review activation</h2>
          <KV
            items={[
              ["Plan", "Yearly VIP (365 days)"],
              ["Coverage", "All lessons and features"],
              ["Account", account],
              ["Current access", <Pill tone="success">Active until 31 Oct 2027</Pill>],
              ["New end date", "31 Oct 2028"],
            ]}
          />
          <Notice>The new days are added after your current VIP time. The code is used only when you confirm.</Notice>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              ← Edit code
            </button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              Confirm activation
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack" style={{ justifyItems: "start" }}>
          <Pill tone="success">
            <Icon name="check" size={14} /> Activated
          </Pill>
          <h2>Subscription activated!</h2>
          <p className="muted">Yearly VIP is now on {account}, until 31 Oct 2028. Sign in to the Nahj app with this account.</p>
          <div className="row">
            <Link to="/account" className="btn btn-primary">
              Open my subscription
            </Link>
            <button className="btn btn-outline" onClick={() => { setCode(""); setStep(0); }}>
              Redeem another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
