"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Mail, MessageCircleQuestion, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Entry } from "@/lib/help-kb";
import { ask, GREETING_RE, suggestions, THANKS_RE } from "@/lib/help-match";

// Mira on the website: the same answers as the phone app (they come from one place, /api/help), the same
// "send this to our team" flow, and the same replies. Reply from the Super Admin shows up here and in the app.

type Msg = { id: number; from: "mira" | "me"; text: string; related?: string[]; offer?: boolean };
type Thread = { id: string; question: string; reply: string | null };

export default function HelpChat({ role, name }: { role: "manager" | "waiter"; name?: string }) {
  const [open, setOpen] = useState(false);
  const [kb, setKb] = useState<Entry[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [last, setLast] = useState("");
  const idRef = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  const push = useCallback((from: "mira" | "me", t: string, extra: Partial<Msg> = {}) => {
    setMsgs((m) => [...m, { id: idRef.current++, from, text: t, ...extra }]);
    setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // A quiet check for replies from our team, so the button can show a dot.
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch("/api/support", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: any) => live && d && setUnseen(d.unseen || 0))
        .catch(() => {});
    check();
    const t = setInterval(check, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/help?client=web", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => d && setKb(d.entries))
      .catch(() => {});
    if (!msgs.length) {
      const first = name ? name.split(" ")[0] : "";
      setMsgs([{ id: idRef.current++, from: "mira", text: `Hi${first ? " " + first : ""}! I'm Mira. Ask me anything about Table Secret, or pick a question below. If I can't answer, I'll send it to our team for you.` }]);
      fetch("/api/support", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: any) => {
          if (!d) return;
          const hist: Msg[] = [];
          for (const t of (d.items as Thread[]).slice(-6)) {
            hist.push({ id: idRef.current++, from: "me", text: t.question });
            hist.push({ id: idRef.current++, from: "mira", text: t.reply ? "Reply from our team:\n\n" + t.reply : "Your question is with our team. You will get the reply here, by email and in the app." });
          }
          if (hist.length) setMsgs((m) => [m[0], ...hist]);
          if (d.unseen) fetch("/api/support/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() => setUnseen(0)).catch(() => {});
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chips = useMemo(() => suggestions(kb, role, true), [kb, role]);

  function reply(q: string) {
    const clean = q.trim();
    if (!clean) return;
    push("me", clean);
    setText("");
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      const lower = clean.toLowerCase();
      if (GREETING_RE.test(lower) && clean.length < 20) return push("mira", "Hello! What would you like to know?");
      if (THANKS_RE.test(lower) && clean.length < 25) return push("mira", "Happy to help! Ask me anything else any time.");
      const found = ask(kb, clean);
      const top = found[0];
      if (top && top.score >= 2) {
        const others = found.slice(1, 3).filter((f) => f.score >= Math.max(2, top.score * 0.6));
        push("mira", top.entry.a, { related: others.map((o) => o.entry.q) });
      } else {
        setLast(clean);
        push("mira", "I don't have an answer for that one yet. Want me to send it to our team? They reply to you by email.", { offer: true });
      }
    }, 350);
  }

  async function send() {
    const q = last || [...msgs].reverse().find((m) => m.from === "me")?.text || "";
    if (!q) return push("mira", "Type your question first, then send it to our team.");
    setSending(true);
    setFormError("");
    try {
      const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, email: email.trim() || undefined }) });
      const d = (await r.json()) as any;
      if (!r.ok) {
        if (d.needEmail) {
          setNeedEmail(true);
          return;
        }
        throw new Error(d.error || "Could not send.");
      }
      setNeedEmail(false);
      push("mira", `Sent! Our team will reply to ${d.email}, and the answer will also show up here and in the app. Anything else I can help with?`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" className="hc-open" onClick={() => setOpen(true)} aria-label={unseen ? `Ask Mira. ${unseen} new ${unseen === 1 ? "reply" : "replies"}` : "Ask Mira"}>
        <span className="orb" aria-hidden />
        <span>Ask Mira</span>
        {unseen > 0 && <i aria-hidden />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="hc-modal">
          <DialogTitle className="hc-title">
            <span className="orb" aria-hidden />
            <span>
              Mira
              <small>Your Table Secret guide</small>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">Ask a question about Table Secret.</DialogDescription>

          <div className="hc-body">
            {msgs.map((m) => (
              <div key={m.id} className={`hc-row ${m.from}`}>
                <div className="hc-bubble">{m.text}</div>
                {m.related && m.related.length > 0 && (
                  <div className="hc-chips">
                    <small>You may also want to know</small>
                    {m.related.map((q) => (
                      <button key={q} className="chip" onClick={() => reply(q)}>{q}</button>
                    ))}
                  </div>
                )}
                {m.offer && !needEmail && (
                  <button className="primary hc-send" onClick={send} disabled={sending}>
                    <Mail size={16} /> {sending ? "Sending…" : "Send this to our team"}
                  </button>
                )}
              </div>
            ))}
            {thinking && <div className="hc-row mira"><div className="hc-bubble hc-dots">•••</div></div>}
            {needEmail && (
              <div className="hc-form">
                <strong>Where should we reply?</strong>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Your email" />
                {formError && <p className="error">{formError}</p>}
                <button className="primary" onClick={send} disabled={sending || !/^\S+@\S+\.\S+$/.test(email)}>Send</button>
              </div>
            )}
            {formError && !needEmail && <p className="error">{formError}</p>}
            {msgs.length <= 1 && chips.length > 0 && (
              <div className="hc-chips">
                <small>Popular questions</small>
                {chips.map((c) => (
                  <button key={c.id} className="chip" onClick={() => reply(c.q)}>{c.q}</button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            className="hc-input"
            onSubmit={(e) => {
              e.preventDefault();
              reply(text);
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Mira a question…" aria-label="Your question" />
            <button type="submit" className="primary" aria-label="Send" disabled={!text.trim()}>
              <ArrowUp size={18} />
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
