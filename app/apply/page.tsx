"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronDown,
  Clock,
  Gamepad2,
  KeyRound,
  Languages,
  Lock,
  MapPin,
  MessageSquareHeart,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Utensils,
  WifiOff,
} from "lucide-react";

type PlanKey = "trial" | "monthly" | "half_yearly" | "yearly";

const PLAN_CARDS: { key: PlanKey; title: string; price: string; note: string; best?: boolean }[] = [
  { key: "trial", title: "Free 7-day trial", price: "₹0", note: "Start now, choose a plan later" },
  { key: "monthly", title: "Monthly", price: "₹2,999", note: "Pay month to month" },
  { key: "yearly", title: "Yearly", price: "₹24,999", note: "Best value, save 58%", best: true },
  { key: "half_yearly", title: "Half-yearly", price: "₹14,999", note: "6 months, save 50%" },
];

const FEATURES = [
  { icon: QrCode, title: "No app for guests", text: "Guests scan the QR on the table and order from their own phone. Nothing to install, ever." },
  { icon: KeyRound, title: "Secret dishes", text: "Hide special dishes behind an Unlock the secret button. Guests love finding them." },
  { icon: Gamepad2, title: "Taste quiz and table games", text: "A short taste quiz suggests dishes, and table games keep waiting guests happy." },
  { icon: BellRing, title: "Live order alerts", text: "New orders buzz your waiters' phones instantly, even when the app is closed." },
  { icon: Users, title: "Managers and waiters", text: "Waiters see only orders. Managers run the menu, team and reports. Nobody sees more than they should." },
  { icon: BarChart3, title: "Daily insights", text: "Best seller, top earner and what did not sell, summarised for you every morning." },
  { icon: MessageSquareHeart, title: "Private reviews", text: "Guests leave honest feedback just for you, not for the whole internet." },
  { icon: Languages, title: "Many languages and dark mode", text: "The guest menu switches language and light or dark theme in one tap." },
  { icon: WifiOff, title: "Offline menu", text: "Guests can save your menu on their phone and read it even with weak signal." },
  { icon: Smartphone, title: "iPhone and Android app", text: "Your team runs everything from one staff app, with the same controls as this website." },
];

const STEPS = [
  { title: "You apply", text: "Tell us about you and your restaurant. It takes about two minutes." },
  { title: "We verify", text: "Our team checks your details, usually within one working day." },
  { title: "You get approved", text: "We email you, and your restaurant, menu and manager login are created for you." },
  { title: "Start your free week", text: "Sign in, add your dishes and waiters, and print your table QR codes." },
];

const FAQS = [
  { q: "What is Table Secret?", a: "A QR menu and ordering system for restaurants. Guests scan a code on the table, browse your menu and order. Your waiters receive each order live, and you manage everything from the website or the staff app." },
  { q: "Why is it different from other QR menu tools?", a: "It is built around the dining room, not just a PDF menu. You get secret dishes, a taste quiz, table games, live waiter alerts, private reviews and a morning insights summary, plus a staff app for iPhone and Android with the same controls as the website." },
  { q: "Do my guests need to download anything?", a: "No. They scan the QR code and the menu opens in their browser. They can also save the menu offline on their phone." },
  { q: "How long does approval take?", a: "Our team reviews every request by hand, normally within one working day. You see the status live on this page, and we email you the moment you are approved." },
  { q: "What do I get after approval?", a: "Your restaurant page, a starter menu, a manager login, a 7-day free trial with everything unlocked, and your table QR code ready to print." },
  { q: "What is my login ID?", a: "The name you choose here plus @as426studios.com, for example spice@as426studios.com. It is only used to sign in, it is not a mailbox. We send all emails to the contact email you give us." },
  { q: "How do waiters get accounts?", a: "Once you are approved, you add waiters yourself from the Team section. Each gets a temporary password and chooses their own on first sign-in. You can reset, suspend or remove a waiter any time." },
  { q: "What happens after the free trial?", a: "You pick a plan: Monthly ₹2,999, Half-yearly ₹14,999 or Yearly ₹24,999. Our team contacts you to complete payment and activates it. Your data is always kept." },
  { q: "Can I try it before applying?", a: "Yes. On the staff app you can start a free 7-day guest week with a sample restaurant. It has a few limits, and registering removes them." },
  { q: "Is my data safe?", a: "Your restaurant's data sits in a private database that only your own accounts can open. Passwords are stored encrypted, and sessions end automatically if an account is removed." },
  { q: "What if I need help?", a: "Open the staff app and ask Mira, our built-in guide. If she cannot answer, your question goes straight to our team and we reply by email and in the app." },
];

type Status = { status: "pending" | "approved" | "rejected"; restaurantName?: string; loginEmail?: string; note?: string | null };

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    ownerName: "",
    phone: "",
    contactEmail: "",
    restaurantName: "",
    address: "",
    city: "",
    username: "",
    password: "",
    planChoice: "trial" as PlanKey,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [reqId, setReqId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState(0);
  const [faqOpen, setFaqOpen] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Come back later and see the same live status.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ts_apply");
      if (saved) {
        const { id, email } = JSON.parse(saved);
        if (id) {
          setReqId(id);
          setLoginEmail(email || "");
        }
      }
    } catch {}
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/register?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
      else if (res.status === 404) {
        localStorage.removeItem("ts_apply");
        setReqId("");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!reqId) return;
    poll(reqId);
    const t = setInterval(() => poll(reqId), 8000);
    return () => clearInterval(t);
  }, [reqId, poll]);

  // The "verifying" animation: each stage lights up in turn while our team reviews.
  useEffect(() => {
    if (!reqId) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reqId]);

  const emailOk = /^\S+@\S+\.\S+$/.test(f.contactEmail.trim());

  function validate(s: number) {
    if (s === 0) {
      if (f.ownerName.trim().length < 2) return "Please enter your name.";
      if (f.phone.trim().length < 6) return "Please enter a phone number we can call.";
      if (!emailOk) return "Please enter a valid contact email. Your approval email goes there.";
    }
    if (s === 1) {
      if (f.restaurantName.trim().length < 2) return "Please enter your restaurant name.";
      if (f.address.trim().length < 5) return "Please enter the street address.";
      if (f.city.trim().length < 2) return "Please enter the city.";
    }
    if (s === 2) {
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(f.username.trim().toLowerCase())) return "Login name: 3 to 30 letters, numbers, dots or dashes.";
      if (f.password.length < 6) return "Password needs at least 6 characters.";
    }
    return "";
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep((s) => s + 1);
  }

  function locate() {
    if (!navigator.geolocation) return setError("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setError("");
      },
      () => setError("We could not get your location. You can skip this."),
      { timeout: 8000 }
    );
  }

  async function submit() {
    const e = validate(2);
    setError(e);
    if (e) return;
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          contactEmail: f.contactEmail.trim().toLowerCase(),
          username: f.username.trim().toLowerCase(),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Could not send your request.");
      localStorage.setItem("ts_apply", JSON.stringify({ id: data.id, email: data.loginEmail }));
      setLoginEmail(data.loginEmail);
      setReqId(data.id);
      setStatus({ status: "pending", restaurantName: f.restaurantName });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    try {
      localStorage.removeItem("ts_apply");
    } catch {}
    setReqId("");
    setStatus(null);
    setStep(0);
    setF({ ownerName: "", phone: "", contactEmail: "", restaurantName: "", address: "", city: "", username: "", password: "", planChoice: "trial" });
  }

  const stages = useMemo(() => {
    const done = status?.status === "approved" || status?.status === "rejected";
    return [
      { label: "Request received", sub: "Your details are safely with us.", state: "done" as const },
      { label: "Checking your details", sub: "Name, contact and location.", state: phase >= 1 ? ("done" as const) : ("active" as const) },
      {
        label: "Our team is verifying your restaurant",
        sub: done ? "Review finished." : "A real person looks at every request. This usually takes up to one working day.",
        state: done ? ("done" as const) : phase >= 2 ? ("active" as const) : ("wait" as const),
      },
      {
        label: status?.status === "rejected" ? "Not approved this time" : "Approved and ready",
        sub: status?.status === "approved" ? "Your restaurant and manager login are live." : status?.status === "rejected" ? status.note || "Please check your email for details." : "We email you the moment it is done.",
        state: status?.status === "approved" ? ("done" as const) : status?.status === "rejected" ? ("bad" as const) : ("wait" as const),
      },
    ];
  }, [status, phase]);

  const submitted = !!reqId;

  return (
    <div className="ap">
      <style>{css}</style>

      <header className="ap-bar">
        <a className="ap-brand" href="/">
          <span className="ap-mark">
            <Utensils size={18} />
          </span>
          AS 426 <span>STUDIOS</span>
        </a>
        <a className="ap-link" href="/login">
          <ArrowLeft size={15} /> Back to sign in
        </a>
      </header>

      <section className="ap-hero">
        <span className="ap-pill">
          <Sparkles size={13} /> FOR RESTAURANT OWNERS
        </span>
        <h1>
          Bring your restaurant to <em>Table Secret</em>
        </h1>
        <p>Apply in two minutes. Our team verifies every restaurant, then you get a free 7-day trial with everything unlocked.</p>
        <div className="ap-chips">
          <span>
            <Clock size={14} /> Reply within one working day
          </span>
          <span>
            <ShieldCheck size={14} /> Verified by a real person
          </span>
          <span>
            <Lock size={14} /> No payment today
          </span>
        </div>
      </section>

      <main className="ap-main" ref={formRef}>
        {!submitted ? (
          <div className="ap-grid">
            <div className="ap-card">
              <div className="ap-steps">
                {["About you", "Restaurant", "Login and plan"].map((t, i) => (
                  <div key={t} className={`ap-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}>
                    <span>{i < step ? <Check size={13} /> : i + 1}</span>
                    {t}
                  </div>
                ))}
              </div>
              <div className="ap-bar-track">
                <div style={{ width: `${((step + 1) / 3) * 100}%` }} />
              </div>

              {error && (
                <div className="ap-error" role="alert">
                  {error}
                </div>
              )}

              {step === 0 && (
                <div className="ap-fields" key="s0">
                  <h2>Tell us about you</h2>
                  <label>
                    Your name
                    <input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Priya Sharma" autoComplete="name" />
                  </label>
                  <label>
                    Phone number
                    <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" inputMode="tel" autoComplete="tel" />
                  </label>
                  <label>
                    Contact email
                    <input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="you@gmail.com" type="email" autoComplete="email" />
                    <small>Use an inbox you check. Your approval message is sent here.</small>
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="ap-fields" key="s1">
                  <h2>Your restaurant</h2>
                  <label>
                    Restaurant name
                    <input value={f.restaurantName} onChange={(e) => set("restaurantName", e.target.value)} placeholder="Spice Route Kitchen" />
                  </label>
                  <label>
                    Street address
                    <input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="12 MG Road, near the old market" />
                  </label>
                  <label>
                    City
                    <input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" />
                  </label>
                  <button type="button" className="ap-ghost" onClick={locate}>
                    <MapPin size={15} /> {coords ? "Location added" : "Add my current location (optional)"}
                    {coords && <Check size={15} />}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="ap-fields" key="s2">
                  <h2>Choose your login and plan</h2>
                  <label>
                    Login name
                    <div className="ap-suffix">
                      <input value={f.username} onChange={(e) => set("username", e.target.value.replace(/\s/g, ""))} placeholder="spiceroute" autoCapitalize="none" />
                      <span>@as426studios.com</span>
                    </div>
                    <small>This is how you sign in. It is not a mailbox.</small>
                  </label>
                  <label>
                    Password
                    <div className="ap-suffix">
                      <input value={f.password} onChange={(e) => set("password", e.target.value)} type={showPw ? "text" : "password"} placeholder="At least 6 characters" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPw((s) => !s)}>
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                  <div className="ap-plans">
                    {PLAN_CARDS.map((p) => (
                      <button type="button" key={p.key} className={`ap-plan ${f.planChoice === p.key ? "on" : ""}`} onClick={() => set("planChoice", p.key)}>
                        {p.best && <b>BEST VALUE</b>}
                        <strong>{p.title}</strong>
                        <span>{p.price}</span>
                        <small>{p.note}</small>
                      </button>
                    ))}
                  </div>
                  <small className="ap-fine">Nothing is charged today. Every plan starts with your free 7-day trial.</small>
                </div>
              )}

              <div className="ap-actions">
                {step > 0 ? (
                  <button type="button" className="ap-back" onClick={() => { setError(""); setStep(step - 1); }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                ) : (
                  <span />
                )}
                {step < 2 ? (
                  <button type="button" className="ap-primary" onClick={next}>
                    Continue <ArrowRight size={15} />
                  </button>
                ) : (
                  <button type="button" className="ap-primary" onClick={submit} disabled={loading}>
                    {loading ? "Sending…" : "Send my application"} <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>

            <aside className="ap-side">
              <h3>What happens next</h3>
              {STEPS.map((s, i) => (
                <div className="ap-next" key={s.title}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.text}</p>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        ) : (
          <div className="ap-card ap-status">
            <span className={`ap-pill ${status?.status === "approved" ? "ok" : status?.status === "rejected" ? "bad" : ""}`}>
              {status?.status === "approved" ? "APPROVED" : status?.status === "rejected" ? "NOT APPROVED" : "UNDER REVIEW"}
            </span>
            <h2>
              {status?.status === "approved"
                ? "You are in! Welcome to Table Secret 🎉"
                : status?.status === "rejected"
                ? "We could not approve this request"
                : "Thanks! Our team is verifying your restaurant"}
            </h2>
            <p className="ap-sub">
              {status?.restaurantName ? <b>{status.restaurantName}</b> : "Your restaurant"}
              {status?.status === "pending" ? " is in the queue. You can close this page, we will email you, or keep it open to watch the status update live." : ""}
            </p>

            <ol className="ap-timeline">
              {stages.map((s) => (
                <li key={s.label} className={s.state}>
                  <span className="dot">{s.state === "done" ? <Check size={14} /> : s.state === "bad" ? "!" : ""}</span>
                  <div>
                    <strong>{s.label}</strong>
                    <p>{s.sub}</p>
                  </div>
                </li>
              ))}
            </ol>

            {status?.status === "approved" && (
              <div className="ap-done">
                <p>
                  Sign in with <b>{status.loginEmail || loginEmail}</b> and the password you chose. Your 7-day free trial has started.
                </p>
                <a className="ap-primary" href="/login">
                  Sign in now <ArrowRight size={15} />
                </a>
              </div>
            )}
            {status?.status === "rejected" && (
              <div className="ap-done">
                <button className="ap-primary" onClick={startOver}>
                  Apply again
                </button>
              </div>
            )}
            {(!status || status.status === "pending") && (
              <p className="ap-fine">
                Login ID you chose: <b>{loginEmail}</b> · <button className="ap-text" onClick={startOver}>Start a new application</button>
              </p>
            )}
          </div>
        )}

        <section className="ap-section">
          <span className="ap-pill">
            <Sparkles size={13} /> WHY TABLE SECRET
          </span>
          <h2>More than a menu on a screen</h2>
          <p className="ap-lead">Everything a busy dining room needs, in one place, without making your guests install anything.</p>
          <div className="ap-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="ap-feature" key={title}>
                <span>
                  <Icon size={20} />
                </span>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ap-section">
          <span className="ap-pill">
            <MessageSquareHeart size={13} /> QUESTIONS
          </span>
          <h2>Good to know before you apply</h2>
          <div className="ap-faq">
            {FAQS.map((x, i) => (
              <div key={x.q} className={`ap-q ${faqOpen === i ? "open" : ""}`}>
                <button type="button" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} aria-expanded={faqOpen === i}>
                  {x.q}
                  <ChevronDown size={18} />
                </button>
                <div className="ap-a">
                  <p>{x.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="ap-foot">AS 426 Studios · Secure Restaurant Experience Platform</footer>
    </div>
  );
}

const css = `
.ap{--o:#df4d03;--od:#b83d00;--ink:#1c1917;--mut:#6f6a65;--line:#e8e6e2;min-height:100vh;background:linear-gradient(180deg,#fff 0,#f8f7f5 380px);color:var(--ink);font-family:inherit}
.ap *{box-sizing:border-box}
.ap-bar{display:flex;justify-content:space-between;align-items:center;padding:16px clamp(16px,4vw,40px)}
.ap-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.04em;color:var(--ink);text-decoration:none}
.ap-brand span:last-child{color:var(--mut);font-weight:600}
.ap-mark{display:inline-flex;width:34px;height:34px;border-radius:10px;background:var(--o);color:#fff;align-items:center;justify-content:center}
.ap-link{display:inline-flex;gap:6px;align-items:center;color:var(--od);font-weight:700;text-decoration:none;font-size:.9rem}
.ap-hero{text-align:center;max-width:760px;margin:0 auto;padding:30px 20px 10px}
.ap-pill{display:inline-flex;gap:6px;align-items:center;background:#fff1e8;color:var(--od);border:1px solid #f6d7c3;border-radius:999px;padding:6px 12px;font-size:.72rem;font-weight:800;letter-spacing:.08em}
.ap-pill.ok{background:#dcfce7;color:#166534;border-color:#bbf7d0}.ap-pill.bad{background:#fee2e2;color:#b91c1c;border-color:#fecaca}
.ap-hero h1{font-size:clamp(2rem,5vw,3.1rem);line-height:1.1;margin:16px 0 12px;letter-spacing:-.02em;font-weight:800}
.ap-hero h1 em{font-style:normal;color:var(--o)}
.ap-hero p{color:var(--mut);font-size:1.05rem;max-width:560px;margin:0 auto}
.ap-chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
.ap-chips span{display:inline-flex;gap:6px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-size:.82rem;color:var(--ink)}
.ap-chips svg{color:var(--o)}
.ap-main{max-width:1040px;margin:0 auto;padding:26px clamp(16px,4vw,28px) 40px}
.ap-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:start}
.ap-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:0 10px 34px rgba(28,25,23,.06)}
.ap-steps{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.ap-step{display:flex;align-items:center;gap:7px;font-size:.82rem;color:var(--mut);font-weight:600}
.ap-step span{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#efedea;align-items:center;justify-content:center;font-size:.75rem;font-weight:800}
.ap-step.on{color:var(--ink)}.ap-step.on span{background:var(--o);color:#fff}.ap-step.done span{background:#dcfce7;color:#166534}
.ap-step+.ap-step::before{content:"";width:18px;height:1px;background:var(--line);margin-right:4px}
.ap-bar-track{height:5px;background:#efedea;border-radius:3px;margin-bottom:20px;overflow:hidden}.ap-bar-track div{height:100%;background:var(--o);border-radius:3px;transition:width .35s ease}
.ap-fields{display:grid;gap:14px;animation:apin .35s ease}
.ap-fields h2{font-size:1.25rem;margin:0 0 2px}
@keyframes apin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ap label{display:grid;gap:6px;font-weight:700;font-size:.88rem}
.ap input{width:100%;min-height:48px;border:1px solid #dcd9d4;border-radius:12px;padding:10px 14px;font:inherit;font-weight:500;background:#fdfcfb;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.ap input:focus{border-color:var(--o);box-shadow:0 0 0 3px rgba(223,77,3,.15);background:#fff}
.ap small{color:var(--mut);font-weight:500;font-size:.78rem}
.ap-suffix{display:flex;align-items:stretch;border:1px solid #dcd9d4;border-radius:12px;background:#fdfcfb;overflow:hidden}
.ap-suffix:focus-within{border-color:var(--o);box-shadow:0 0 0 3px rgba(223,77,3,.15)}
.ap-suffix input{border:0;box-shadow:none;border-radius:0;background:transparent}
.ap-suffix span{display:flex;align-items:center;padding:0 12px;color:var(--mut);font-size:.82rem;background:#f3f1ee;white-space:nowrap;font-weight:600}
.ap-suffix button{border:0;background:#f3f1ee;padding:0 14px;font-weight:700;color:var(--od);cursor:pointer}
.ap-ghost{display:inline-flex;gap:8px;align-items:center;justify-content:center;border:1px dashed #f0b999;background:#fffaf6;color:var(--od);border-radius:12px;min-height:46px;font-weight:700;cursor:pointer}
.ap-plans{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.ap-plan{position:relative;display:grid;gap:2px;text-align:left;border:1.5px solid var(--line);background:#fff;border-radius:14px;padding:14px;cursor:pointer;font:inherit;transition:all .15s}
.ap-plan strong{font-size:.92rem}.ap-plan span{font-size:1.25rem;font-weight:800}.ap-plan small{color:var(--mut)}
.ap-plan b{position:absolute;top:-9px;right:10px;background:var(--o);color:#fff;border-radius:999px;font-size:.62rem;padding:3px 8px;letter-spacing:.06em}
.ap-plan:hover{border-color:#f0b999}.ap-plan.on{border-color:var(--o);background:#fff7f1;box-shadow:0 0 0 3px rgba(223,77,3,.12)}
.ap-fine{display:block;color:var(--mut);font-size:.8rem;margin-top:4px}
.ap-actions{display:flex;justify-content:space-between;align-items:center;margin-top:22px}
.ap-primary{display:inline-flex;gap:8px;align-items:center;justify-content:center;background:var(--o);color:#fff;border:0;border-radius:12px;min-height:48px;padding:0 22px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;transition:transform .12s,background .15s}
.ap-primary:hover{background:var(--od)}.ap-primary:active{transform:scale(.97)}.ap-primary:disabled{opacity:.6;cursor:default}
.ap-back{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:12px;min-height:48px;padding:0 18px;font:inherit;font-weight:700;cursor:pointer}
.ap-text{border:0;background:none;color:var(--od);font:inherit;font-weight:700;cursor:pointer;padding:0;text-decoration:underline}
.ap-error{background:#fee2e2;color:#b91c1c;border-radius:12px;padding:11px 14px;font-size:.88rem;margin-bottom:14px;font-weight:600}
.ap-side{background:#fffaf6;border:1px solid #f6d7c3;border-radius:20px;padding:24px;position:sticky;top:20px}
.ap-side h3{margin:0 0 14px;font-size:1.05rem}
.ap-next{display:flex;gap:12px;margin-bottom:16px}.ap-next>span{flex:none;width:28px;height:28px;border-radius:50%;background:var(--o);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem}
.ap-next strong{display:block;font-size:.95rem}.ap-next p{margin:2px 0 0;color:var(--mut);font-size:.85rem;line-height:1.45}
.ap-status{max-width:680px;margin:0 auto;text-align:center}
.ap-status h2{font-size:1.55rem;margin:14px 0 8px}.ap-sub{color:var(--mut);max-width:480px;margin:0 auto 22px}
.ap-timeline{list-style:none;margin:0 auto;padding:0;text-align:left;max-width:460px;display:grid;gap:0}
.ap-timeline li{display:flex;gap:14px;position:relative;padding-bottom:22px}
.ap-timeline li:not(:last-child)::before{content:"";position:absolute;left:13px;top:28px;bottom:0;width:2px;background:var(--line)}
.ap-timeline li.done:not(:last-child)::before{background:#86efac}
.ap-timeline .dot{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff}
.ap-timeline li.done .dot{background:#16a34a;border-color:#16a34a}.ap-timeline li.bad .dot{background:#dc2626;border-color:#dc2626}
.ap-timeline li.active .dot{border-color:var(--o);background:#fff;animation:appulse 1.4s infinite}
.ap-timeline li.active .dot::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--o)}
.ap-timeline li.wait{opacity:.5}
@keyframes appulse{0%{box-shadow:0 0 0 0 rgba(223,77,3,.45)}70%{box-shadow:0 0 0 12px rgba(223,77,3,0)}100%{box-shadow:0 0 0 0 rgba(223,77,3,0)}}
.ap-timeline strong{display:block}.ap-timeline p{margin:2px 0 0;color:var(--mut);font-size:.86rem;line-height:1.45}
.ap-done{margin-top:8px;display:grid;gap:12px;justify-items:center}
.ap-section{margin-top:56px;text-align:center}
.ap-section h2{font-size:clamp(1.5rem,3.4vw,2.1rem);margin:12px 0 8px;letter-spacing:-.01em}
.ap-lead{color:var(--mut);max-width:560px;margin:0 auto 26px}
.ap-features{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;text-align:left}
.ap-feature{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;transition:transform .18s,box-shadow .18s,border-color .18s}
.ap-feature:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(28,25,23,.08);border-color:#f0b999}
.ap-feature span{display:inline-flex;width:40px;height:40px;border-radius:12px;background:#fff1e8;color:var(--o);align-items:center;justify-content:center;margin-bottom:10px}
.ap-feature strong{display:block;margin-bottom:4px}.ap-feature p{margin:0;color:var(--mut);font-size:.88rem;line-height:1.5}
.ap-faq{max-width:760px;margin:22px auto 0;text-align:left;display:grid;gap:10px}
.ap-q{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ap-q button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;background:none;border:0;padding:16px 18px;font:inherit;font-weight:700;text-align:left;cursor:pointer;color:var(--ink)}
.ap-q button svg{flex:none;color:var(--o);transition:transform .25s}
.ap-q.open button svg{transform:rotate(180deg)}.ap-q.open{border-color:#f0b999}
.ap-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s ease}.ap-q.open .ap-a{grid-template-rows:1fr}
.ap-a p{overflow:hidden;margin:0;padding:0 18px;color:var(--mut);line-height:1.6;font-size:.93rem}
.ap-q.open .ap-a p{padding-bottom:16px}
.ap-foot{text-align:center;color:var(--mut);font-size:.8rem;padding:24px}
@media(max-width:860px){.ap-grid{grid-template-columns:1fr}.ap-side{position:static}.ap-card{padding:20px}.ap-plans{grid-template-columns:1fr 1fr}}
@media(max-width:420px){.ap-plans{grid-template-columns:1fr}}
`;
