import type { ReactNode } from "react";

// The business details shown on the legal pages. The email comes from the server settings; the address and phone are
// The phone and address default to the business details below and can be changed with BUSINESS_PHONE and BUSINESS_ADDRESS.
export function business() {
  return {
    name: "AS 426 Studios",
    product: "Table Secret",
    email: process.env.SUPPORT_EMAIL || process.env.MAIL_USER || "",
    phone: process.env.BUSINESS_PHONE || "+91 96638 72103",
    address: process.env.BUSINESS_ADDRESS || "SLV Sunshine Apartment, Defense Layout, Vidyaranyapura, Bangalore, Karnataka",
  };
}

export const LEGAL_UPDATED = "22 October 2026";

export const LEGAL_LINKS = [
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["Refunds", "/refunds"],
  ["Contact", "/contact"],
] as const;

// One look for all four pages: a plain, readable document with the same header and footer links.
export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="lg">
      <style>{css}</style>
      <header className="lg-bar">
        <a className="lg-brand" href="/">
          <span className="lg-mark">TS</span>
          AS 426 <span>STUDIOS</span>
        </a>
        <a className="lg-link" href="/login">
          Team sign in
        </a>
      </header>
      <main className="lg-main">
        <h1>{title}</h1>
        <p className="lg-date">Last updated {LEGAL_UPDATED}</p>
        {intro ? <p className="lg-intro">{intro}</p> : null}
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="lg-foot">
      <nav aria-label="Legal">
        {LEGAL_LINKS.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <span>AS 426 Studios · Table Secret</span>
    </footer>
  );
}

const css = `
.lg{min-height:100vh;background:#faf9f8;color:#1c1917;font-family:"Manrope",system-ui,sans-serif}
.lg *{box-sizing:border-box}
.lg-bar{display:flex;justify-content:space-between;align-items:center;padding:14px clamp(16px,4vw,40px);background:#fff;border-bottom:1px solid #e7e5e4}
.lg-brand{min-height:44px;display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.04em;color:#1c1917;text-decoration:none}
.lg-brand span:last-child{color:#57534e;font-weight:600}
.lg-mark{display:inline-flex;width:34px;height:34px;border-radius:10px;background:#c2410c;color:#fff;align-items:center;justify-content:center;font-size:.8rem}
.lg-link{color:#9a3412;font-weight:700;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.lg-main{max-width:760px;margin:0 auto;padding:32px 20px 48px}
.lg-main h1{margin:0 0 4px;font-size:clamp(1.6rem,4vw,2.1rem)}
.lg-date{color:#78716c;margin:0 0 18px;font-size:.88rem}
.lg-intro{font-size:1.02rem;line-height:1.7;color:#44403c}
.lg-main h2{margin:28px 0 8px;font-size:1.15rem}
.lg-main p,.lg-main li{line-height:1.7;color:#44403c}
.lg-main ul{padding-left:20px;display:grid;gap:6px}
.lg-main a{color:#9a3412;font-weight:600}
.lg-card{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:16px 18px;margin:12px 0}
.lg-foot{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 16px 36px;color:#78716c;font-size:.85rem;border-top:1px solid #e7e5e4;background:#fff}
.lg-foot nav{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
.lg-foot a{color:#57534e;font-weight:600;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.lg-foot a:hover{color:#9a3412}
`;
