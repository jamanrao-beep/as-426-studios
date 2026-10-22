import type { Metadata } from "next";
import { LegalPage, business } from "../legal";

export const metadata: Metadata = { title: "Refund and Cancellation Policy | Table Secret" };
export const dynamic = "force-dynamic";

export default function Refunds() {
  const b = business();
  return (
    <LegalPage title="Refund and Cancellation Policy" intro={`This explains how cancellations and refunds work for ${b.product} plans. Every restaurant starts with a free trial, so you can see exactly what you are paying for before any money is taken.`}>
      <h2>Free trial and guest week</h2>
      <p>The free trial and the guest week cost nothing, and nothing is charged when they end. You only pay when you choose a plan.</p>

      <h2>Cancelling a plan</h2>
      <p>
        You can stop at any time by not renewing. We do not charge anything automatically: a new payment only happens when you choose to pay. After you stop, your plan keeps working until the end of the period you already paid for.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          <b>Monthly plan:</b> the monthly price covers the month it starts, so it is not refunded part way through the month.
        </li>
        <li>
          <b>Half-yearly and yearly plans:</b> if you ask within <b>7 days</b> of the payment, we refund it in full. After 7 days we do not refund the unused part of the plan.
        </li>
        <li>
          <b>Paid twice or charged by mistake:</b> if you were charged twice for the same plan, or charged an amount different from the plan price, we refund the extra amount in full whenever you tell us.
        </li>
        <li>
          <b>The service did not work:</b> if a long outage on our side stopped you from using a plan you paid for, write to us and we will fix it, which may mean extending your plan or refunding part of it.
        </li>
      </ul>

      <h2>How to ask for a refund</h2>
      <p>
        See our <a href="/contact">Contact page</a>
        {b.email ? <>
          {" "}or write to <a href={`mailto:${b.email}`}>{b.email}</a>
        </> : null}{" "}
        from the email address you used to sign up. Tell us your restaurant name, the date and the amount. We reply within 2 working days.
      </p>

      <h2>When you get the money</h2>
      <p>
        An approved refund is sent back through the same method you paid with (UPI, card or net banking) and usually reaches your account within <b>5 to 7 working days</b>, depending on your bank.
      </p>

      <h2>Account closure</h2>
      <p>If we close an account for breaking our <a href="/terms">Terms</a>, the money for the unused part of a plan is not refunded.</p>
    </LegalPage>
  );
}
