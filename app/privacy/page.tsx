import type { Metadata } from "next";
import { LegalPage, business } from "../legal";

export const metadata: Metadata = { title: "Privacy Policy | Table Secret" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  const b = business();
  return (
    <LegalPage title="Privacy Policy" intro={`This policy explains what personal information ${b.name} collects through ${b.product}, why, who we share it with, and the choices you have.`}>
      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Restaurant owners and managers:</b> name, phone number, email address, restaurant name and address, the username you choose, and a password that we keep only as a one-way scrambled value (we cannot read it).
        </li>
        <li>
          <b>Waiters:</b> a name and a username created by their manager. Waiters do not give us an email address.
        </li>
        <li>
          <b>Guest-week visitors:</b> name, phone number and email address, so we can reply and confirm the email with a code.
        </li>
        <li>
          <b>Restaurant guests who scan a QR code:</b> no account is needed. When they order or leave a review we store what they chose, the table number, any note they add, and the dish ratings or feedback they give. Their orders are kept in
          the browser they used so they can follow them.
        </li>
        <li>
          <b>Optional location:</b> if a restaurant shares its position when applying, we store it to help with setup.
        </li>
        <li>
          <b>Phone app notifications:</b> if you allow them, a notification address for your phone so we can alert staff about new orders.
        </li>
        <li>
          <b>Payments:</b> payments are taken by Razorpay. We receive the result (paid or not, the amount and a payment reference). We never see or store your card number, UPI PIN or bank details.
        </li>
        <li>
          <b>Basic technical records:</b> a sign-in cookie, the time of important actions such as sign-ins and password changes, and error logs, so we can keep the service secure.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the service: show menus, take orders, manage staff and show reports.</li>
        <li>To check applications, create accounts and confirm email addresses.</li>
        <li>To send emails you need: verification codes, approval and login details, password reset codes and security notices.</li>
        <li>To take payments, keep plan records and answer your questions.</li>
        <li>To keep the service safe and prevent misuse.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for third-party advertising.</p>

      <h2>Who we share it with</h2>
      <p>We use trusted companies to run the service. They only handle data for that purpose:</p>
      <ul>
        <li>Hosting and database providers (Vercel and Hostinger) to run the website and store data.</li>
        <li>Razorpay, to take payments.</li>
        <li>Google (Gmail) to send our emails.</li>
        <li>Expo, to deliver phone notifications.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect our users and the service.</p>

      <h2>Cookies and storage</h2>
      <p>
        We use a sign-in cookie so you stay signed in, and small items in your browser or phone, for example to remember your restaurant code, language or the orders you placed. We do not use advertising cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep account and order records while your restaurant uses the service and for a reasonable time afterwards, for example for accounts and legal records. Guest sandboxes and their data are deleted when the guest week ends.
        Verification codes expire in minutes.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are stored scrambled, sign-ins are rate limited, managers can only see their own restaurant, and email addresses are confirmed with a code. No system is perfectly secure, so please use a strong password and keep it
        private.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can ask to see, correct or delete the personal information we hold about you.</li>
        <li>You can change your password at any time, and turn off phone notifications in your phone settings.</li>
        <li>If you are a waiter or a guest of a restaurant, your restaurant also controls the information it holds about you.</li>
      </ul>

      <h2>Children</h2>
      <p>The service is for businesses and is not aimed at children under 18.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>

      <h2>Contact</h2>
      <p>
        To use any of your choices, or to ask a question, see our <a href="/contact">Contact page</a>
        {b.email ? <>
          {" "}or write to <a href={`mailto:${b.email}`}>{b.email}</a>
        </> : null}
        .
      </p>
    </LegalPage>
  );
}
