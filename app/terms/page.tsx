import type { Metadata } from "next";
import { LegalPage, business } from "../legal";

export const metadata: Metadata = { title: "Terms and Conditions | Table Secret" };
export const dynamic = "force-dynamic";

export default function Terms() {
  const b = business();
  return (
    <LegalPage title="Terms and Conditions" intro={`These terms are the agreement between you and ${b.name} for using ${b.product}, our QR menu and table-ordering service for restaurants. By creating an account, trying the guest week or using the service, you agree to them.`}>
      <h2>1. What the service is</h2>
      <p>
        {b.product} lets a restaurant publish a menu that guests open by scanning a QR code, take orders and table requests, and manage dishes, staff, reports and reviews on the website and in a mobile app. Guests who scan a QR code
        can browse and order without an account.
      </p>

      <h2>2. Accounts and roles</h2>
      <ul>
        <li>A restaurant applies on our website. We review each application and may approve or decline it.</li>
        <li>A restaurant has managers and waiters. Each person signs in with a restaurant code, a username and a password. A username only has to be unique inside its own restaurant.</li>
        <li>You must give true details and a real email address that you can read. We check email addresses with a code we send to them.</li>
        <li>You are responsible for what happens under your account. Keep your password private, and tell us straight away if you think someone else has it.</li>
        <li>Only the restaurant&apos;s managers can add waiters. Adding another manager needs our approval.</li>
      </ul>

      <h2>3. Free trial and guest week</h2>
      <p>
        An approved restaurant starts with a free trial. Anyone can also try a sample restaurant as a guest for a limited week, once per email address. Guest sandboxes have limits on dishes and staff accounts and are deleted when the
        week ends. We may change the length of the trial or guest week for new sign-ups.
      </p>

      <h2>4. Plans and payment</h2>
      <ul>
        <li>After the trial, a restaurant needs a paid plan to keep using the service. Plans, prices and lengths are shown on our Plans page, in Indian rupees. Prices may change for future purchases.</li>
        <li>You can pay online by UPI, card or net banking through our payment partner Razorpay, or we can set up and record a payment you made to us another way.</li>
        <li>A plan starts when the payment is confirmed. Buying the same plan again adds time to the end of the current period.</li>
        <li>If a plan ends, the workspace is locked until a new plan starts. Your data is kept for a reasonable time so you can come back.</li>
        <li>Refunds are covered by our <a href="/refunds">Refund Policy</a>.</li>
      </ul>

      <h2>5. Your content and your data</h2>
      <p>
        Your menu, prices, photos and the orders and reviews your guests create belong to your restaurant. You give us permission to store and show them in order to run the service. You promise that you have the right to use everything you
        upload and that it does not break anyone&apos;s rights or the law. How we handle personal data is explained in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>6. Acceptable use</h2>
      <ul>
        <li>Do not use the service for anything unlawful, misleading or harmful, or to send spam.</li>
        <li>Do not try to break into other accounts, probe or overload the service, or work around its limits.</li>
        <li>Do not use another restaurant&apos;s name or details to pretend to be them.</li>
      </ul>
      <p>We may suspend or remove an account that breaks these rules, with a reason where we can give one.</p>

      <h2>7. Availability</h2>
      <p>
        We work to keep the service running, but we do not promise it will always be available or error free. We may update, change or pause parts of it, for example for maintenance. Orders depend on your own internet connection, devices
        and staff, so please have a backup way to take orders.
      </p>

      <h2>8. Limits of our responsibility</h2>
      <p>
        To the extent the law allows, {b.name} is not liable for lost profits, lost orders or indirect losses arising from using the service. Our total responsibility for any claim is limited to the amount you paid us for the plan in the
        three months before the claim. Nothing here limits responsibility that the law does not allow us to limit.
      </p>

      <h2>9. Ending your account</h2>
      <p>
        You can stop using the service at any time and ask us to delete your account. We can end or suspend an account that breaks these terms or that has not paid. Parts of these terms that are meant to continue, such as payment and
        responsibility, continue after an account ends.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>We may update these terms. The date at the top shows when they last changed. If you keep using the service after a change, you accept the new terms.</p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of India, and the courts of India have jurisdiction over any dispute.</p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms? See our <a href="/contact">Contact page</a>
        {b.email ? <>
          {" "}or write to <a href={`mailto:${b.email}`}>{b.email}</a>
        </> : null}
        .
      </p>
    </LegalPage>
  );
}
