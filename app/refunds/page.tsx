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
      <p>
        Payments for a plan are <b>not refunded</b>, whether the plan is monthly, half-yearly or yearly, and a plan is not refunded part way through its period. We refund only in these three cases:
      </p>
      <ul>
        <li>
          <b>You were charged twice</b> for the same plan. We refund the extra payment in full.
        </li>
        <li>
          <b>You were charged the wrong amount</b>, meaning an amount different from the price of the plan. We refund the difference, or the whole payment if you want the plan at the right price instead.
        </li>
        <li>
          <b>You were charged but did not get access.</b> If your payment went through and your plan did not start, write to us. We first try to switch it on straight away, and if we cannot, we refund the payment in full.
        </li>
      </ul>
      <p>You can tell us about any of these at any time, there is no deadline.</p>

      <h2>How to ask for a refund</h2>
      <p>
        See our <a href="/contact">Contact page</a>
        {b.email ? <>
          {" "}or write to <a href={`mailto:${b.email}`}>{b.email}</a>
        </> : null}{" "}
        from the email address you used to sign up. Tell us your restaurant name, the date and the amount, and which of the three cases above it is. We reply within 2 working days.
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
