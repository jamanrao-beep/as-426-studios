"use client";

import { useEffect, useState } from "react";
import { Mail, QrCode, Send } from "lucide-react";
import { toast } from "sonner";

// Shown to a manager when the Super Admin has hidden the QR code. Instead of a dead end they can ask for it:
// the request lands in the Super Admin's Queries table (and inbox) with their restaurant and contact details.
export default function QrRequest({ restaurantName }: { restaurantName: string }) {
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/app-config", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ contactEmail?: string | null }>)
      .then((d) => setContact(d.contactEmail || ""))
      .catch(() => {});
  }, []);

  async function request() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: `Please turn on the QR code and customer link for ${restaurantName || "my restaurant"}. I need it for table cards.` }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not send the request.");
      setSent(true);
      toast.success("Request sent. We will turn it on or reply by email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "40px 24px", textAlign: "center", maxWidth: 580, margin: "24px auto", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff4ed", color: "#9a3412", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
        <QrCode size={30} />
      </div>
      <h2 style={{ fontSize: "1.35rem", color: "#0f172a", marginBottom: 8, fontWeight: 700 }}>Your QR code is not switched on yet</h2>
      <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 20px" }}>
        Table Secret turns the QR code on for each restaurant. Ask for it here and we will switch it on, or reply by email if we need anything from you.
      </p>
      {sent ? (
        <p style={{ color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontWeight: 700, margin: 0 }}>
          Request sent. We will get back to you soon.
        </p>
      ) : (
        <button type="button" onClick={request} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 22px", borderRadius: 12, border: 0, background: "#c2410c", color: "#fff", fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
          <Send size={16} /> {busy ? "Sending..." : "Request QR access"}
        </button>
      )}
      {error ? <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: 12 }}>{error}</p> : null}
      {contact ? (
        <p style={{ color: "#57534e", fontSize: "0.85rem", marginTop: 18, display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <Mail size={14} /> Or write to us at <a href={`mailto:${contact}`} style={{ color: "#9a3412", fontWeight: 700 }}>{contact}</a>
        </p>
      ) : null}
    </div>
  );
}
