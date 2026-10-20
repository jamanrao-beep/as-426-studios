"use client";
import { useEffect, useRef, useState } from "react";
import { BellRing, Receipt, Check } from "lucide-react";

type Req = { id: string; table_label: string; kind: "waiter" | "bill"; created_at: string };

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

export default function ServiceRequests({ restaurant }: { restaurant: string }) {
  const [rows, setRows] = useState<Req[]>([]);
  const [error, setError] = useState("");
  const seen = useRef<Set<string> | null>(null);

  async function load() {
    try {
      const r = await fetch(`/api/service-requests?restaurant=${encodeURIComponent(restaurant)}`);
      const d = (await r.json()) as { requests?: Req[]; error?: string };
      if (!r.ok) throw Error(d.error);
      const list = d.requests || [];
      if (seen.current && list.some((x) => !seen.current!.has(x.id))) beep();
      seen.current = new Set(list.map((x) => x.id));
      setRows(list);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load table requests");
    }
  }

  useEffect(() => {
    seen.current = null;
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [restaurant]);

  async function done(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await fetch("/api/service-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant, id }),
    }).catch(() => {});
    load();
  }

  if (!rows.length && !error) return null;
  return (
    <section className="service-requests" aria-live="polite">
      <strong>
        <BellRing size={16} /> Table requests {rows.length > 0 && `(${rows.length})`}
      </strong>
      {error && <p className="error">{error}</p>}
      <div className="service-list">
        {rows.map((r) => (
          <div key={r.id} className={`service-item ${r.kind}`}>
            <span>
              {r.kind === "bill" ? <Receipt size={16} /> : <BellRing size={16} />}
              <b>Table {r.table_label}</b> · {r.kind === "bill" ? "wants the bill" : "needs a waiter"}
            </span>
            <button onClick={() => done(r.id)}>
              <Check size={14} /> Done
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
