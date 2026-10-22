import type { Metadata } from "next";
import { LegalPage, business } from "../legal";

export const metadata: Metadata = { title: "Contact Us | Table Secret" };
export const dynamic = "force-dynamic";

export default function Contact() {
  const b = business();
  return (
    <LegalPage title="Contact Us" intro={`Questions about ${b.product}, your plan, a payment or your data? Here is how to reach ${b.name}.`}>
      <div className="lg-card">
        <p style={{ margin: 0 }}>
          <b>Business:</b> {b.name}, operating {b.product}
        </p>
        {b.email ? (
          <p style={{ margin: "8px 0 0" }}>
            <b>Email:</b> <a href={`mailto:${b.email}`}>{b.email}</a>
          </p>
        ) : null}
        {b.phone ? (
          <p style={{ margin: "8px 0 0" }}>
            <b>Phone:</b> <a href={`tel:${b.phone.replace(/\s/g, "")}`}>{b.phone}</a>
          </p>
        ) : null}
        {b.address ? (
          <p style={{ margin: "8px 0 0" }}>
            <b>Address:</b> {b.address}
          </p>
        ) : null}
        <p style={{ margin: "8px 0 0" }}>
          <b>Reply time:</b> within 2 working days.
        </p>
      </div>

      <h2>Already using Table Secret?</h2>
      <p>
        Open the Help chat (Mira) inside your workspace or the app. If Mira cannot answer, your question comes to us and we reply by email and inside the app.
      </p>

      <h2>For payments and refunds</h2>
      <p>
        Write from the email you used to sign up, with your restaurant name, the date and the amount. Our <a href="/refunds">Refund Policy</a> explains what we can refund.
      </p>

      <h2>New restaurant?</h2>
      <p>
        You can <a href="/apply">apply to join</a>, <a href="/guest">try a guest week</a> or <a href="/plans">see plans and pricing</a>.
      </p>
    </LegalPage>
  );
}
