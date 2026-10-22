# Table Secret: launch checklist

Tick each box as you go. Do the parts in order. Never paste a password, key or secret into a chat or an email: they go
only into the Vercel settings screen.

Your live site: https://as-426-studios-2026.vercel.app

---

## Part 1. Check the latest version is live (5 minutes)

- [ ] Open **vercel.com → your project → Deployments**. The newest deployment (commit message starts "Business phone and
      address…") should say **Ready**. If it says Error, open it and send me the red lines.
- [ ] If Deployments shows nothing new: **Settings → Git**, make sure the production branch is `main`, then on the
      newest deployment click **⋯ → Redeploy**.
- [ ] Visit `/terms`, `/privacy`, `/refunds`, `/contact`, `/plans`, `/guest` on your site. They should all open.

## Part 2. Vercel settings (15 minutes)

**Where:** Vercel → your project → **Settings → Environment Variables**. Add each one for **Production**. After adding
or changing any of them, go to **Deployments → ⋯ → Redeploy**, because a running deployment does not see new values.

| Name | What it is | Where you get it |
|---|---|---|
| `SESSION_SECRET` | A long random text that signs logins. Keep the one you already have. If you change it, everyone is signed out. | Already set. If missing, make 40+ random characters. |
| `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Your Hostinger database | Already set. Hostinger hPanel → Websites → Databases → Management |
| `MYSQL_PORT` | Only if it is not 3306 | hPanel (usually leave it out) |
| `MAIL_USER` | The Gmail address that sends emails, e.g. as426.studios@gmail.com | You |
| `MAIL_PASS` | The Gmail **App password** (not your normal password). Spaces are fine, no quotes. | Google Account → Security → 2-Step Verification → **App passwords** |
| `SUPPORT_EMAIL` | Optional. Where customer questions arrive, and the email shown on the Contact page. Leave out to use `MAIL_USER`. | You |
| `RAZORPAY_KEY_ID` | Public key. Starts `rzp_test_` or `rzp_live_` | Part 5 below |
| `RAZORPAY_KEY_SECRET` | Secret key, shown once | Part 5 below |
| `RAZORPAY_WEBHOOK_SECRET` | A secret you invent (see Part 5) | You make it up |
| `BUSINESS_PHONE`, `BUSINESS_ADDRESS` | Optional. Already built in; only set to change them. | You |

Do **not** add `RAZORPAY_API_BASE`, `DEV_ADMIN_EMAIL` or `DEV_ADMIN_PASSWORD` on the live site.

- [ ] Region (the biggest speed-up): **Settings → Functions → Function Region**. Add **Asia Pacific → Mumbai (bom1)**
      and remove iad1. Your Hostinger server is in Mumbai. Then redeploy.

## Part 3. Email (10 minutes)

- [ ] `MAIL_USER` and `MAIL_PASS` are in Vercel and you redeployed.
- [ ] Sign in to the website as Super Admin → **Mobile app** → **Send test email**. It should say it sent. If it shows a
      message about "App password", the Gmail password is wrong or 2-Step Verification is off.
- [ ] Check the email really arrives in your inbox (and look in Spam once).

## Part 4. Your Super Admin login

- [ ] You must be able to sign in at `/login` as Super Admin. If you cannot remember it, tell me and I will give you the
      exact steps to reset it in **Hostinger → Databases → phpMyAdmin**. Do this before launch.
- [ ] Sign in and open **People and usage**, **Set up a restaurant**, **New requests**, **Manager requests**, **Plans &
      trials**, **Mobile app**. They should all open without errors.

## Part 5. Razorpay: everything, and where to find it

Razorpay has **two modes**: **Test** and **Live**. There is a switch at the top of the Razorpay dashboard. Test mode
uses fake money. Keys, webhooks and settings are **separate for each mode**, so you will repeat steps 5.3 to 5.5 again
when you go Live.

### 5.1 Make the account
- [ ] Go to **dashboard.razorpay.com** and sign up with the business email and mobile (+91 96638 72103).
- [ ] You can use **Test mode straight away**, before any approval.

### 5.2 Get the account approved for real money (do this early, it takes days)
- [ ] On the dashboard, click the **Activate your account** banner (or **Account & Settings → Business details /
      Profile**).
- [ ] Have these ready: your **PAN**, your **bank account** (account number, IFSC, name matching your PAN), your business
      type (individual, proprietorship, company), your **address** (SLV Sunshine Apartment, Defense Layout,
      Vidyaranyapura, Bangalore, Karnataka) and **GST** if you have one.
- [ ] **Website:** enter `https://as-426-studios-2026.vercel.app`. Razorpay checks that the site has Terms, Privacy,
      Refund and Contact pages with your phone, email and address. They are all there now.
- [ ] Describe the business honestly: a software service that restaurants subscribe to for QR menus and ordering,
      paid monthly, half-yearly or yearly.

### 5.3 Get the two keys (Test mode first)
- [ ] Switch the dashboard to **Test Mode**.
- [ ] **Account & Settings → API Keys** (under "Website and app settings") → **Generate Test Key**.
- [ ] Copy **Key Id** (`rzp_test_…`) and **Key Secret**. The secret is shown **only once**: download or copy it
      straight into Vercel.
- [ ] Vercel → add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

### 5.4 Add the webhook (this is how a UPI QR payment is noticed)
- [ ] Make up a long random string. This is your **webhook secret**. Put it in Vercel as `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Account & Settings → Webhooks → Add New Webhook** (in the same mode, Test).
- [ ] **Webhook URL:** `https://as-426-studios-2026.vercel.app/api/payments/webhook`
- [ ] **Secret:** the same string you put in Vercel.
- [ ] **Active events**, tick exactly these four:
      `payment.captured`, `order.paid`, `payment_link.paid`, `qr_code.credited`
- [ ] Save. Then redeploy Vercel so it picks up the three values.

### 5.5 Ask for UPI QR Codes
- [ ] The in-page QR needs Razorpay's **QR Codes** feature enabled on your account. Look for **QR Codes** in the
      dashboard menu (under Payments or Products). If you cannot use it, use **Help / Support** in the dashboard
      and ask: "Please enable UPI QR Codes (dynamic, single-use, fixed amount) on my account." Until it is enabled,
      the QR button quietly opens the card/net-banking window instead, so nothing breaks.
- [ ] The phone app's "card or net banking" button uses **Payment Links**. If it errors, ask support to enable
      Payment Links too.

### 5.6 Test a payment (Test mode)
- [ ] Sign in as a manager on the website → **Plan and billing** → pick a plan.
- [ ] Press **Pay with UPI QR**. A QR should appear. In Test mode you cannot scan it; instead press **Pay by card or
      net banking** and use Razorpay's test details: card `4111 1111 1111 1111`, any future date, any 3-digit CVV;
      for UPI use the test ID `success@razorpay`. (Razorpay's docs page "Test Card Details" lists current ones.)
- [ ] After paying, the page should say "Payment received" and the plan should show as active.
- [ ] In Super Admin → **Plans & trials**, the payment appears under **Online payments**.
- [ ] In Razorpay → **Transactions → Payments** you see the same payment.
- [ ] In Razorpay → **Webhooks**, open your webhook → **Logs**: calls should show **200**. If you see 400, the secret in
      Razorpay and Vercel do not match exactly.

### 5.7 Go Live (after Razorpay approves the account)
- [ ] Switch the dashboard to **Live Mode**.
- [ ] **API Keys → Generate Live Key**. Replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Vercel with the live ones.
- [ ] Add the **webhook again in Live mode** (5.4), with the same URL, events and a secret. Update
      `RAZORPAY_WEBHOOK_SECRET` if you used a new one.
- [ ] Redeploy.
- [ ] Make one **small real payment yourself** (use a cheap test plan, or pay then ask for a refund from the Razorpay
      dashboard) to prove the whole chain. Then check money lands in your bank: **Settlements** in the dashboard.
- [ ] Fees: about 2% per payment plus 18% GST on the fee. Check Razorpay's current pricing page.

### 5.8 Where to look when something goes wrong
- A payment succeeded in Razorpay but the plan did not start: Razorpay → Webhooks → your webhook → **Logs**. If a call
  failed, press **Retry**. Our server never gives a plan twice for one payment.
- QR button does nothing special: QR Codes is not enabled yet (5.5).
- Vercel → your project → **Logs** shows our server's errors.

## Part 6. Test the live site once (30 minutes)

Do these on the live website. Anything that fails, send me the message and the time.

- [ ] **Apply:** `/apply` with a real email. Verify the email code arrives and works. Submit.
- [ ] **Approve:** Super Admin → **New requests** → Approve. The applicant gets an email with the login ID and restaurant code.
- [ ] **Sign in** as that new owner with restaurant code + username.
- [ ] **Set up by hand:** Super Admin → **Set up a restaurant**. Verify the email, create it, sign in as that owner.
- [ ] **Add a waiter:** manager → **Manage waiters**. Sign in as the waiter in another browser.
- [ ] **Forgot password:** `/forgot-password` for the owner. The code arrives, a new password works.
- [ ] **Manager request:** manager → **Add a manager** → verify email → Super Admin approves.
- [ ] **Guest:** `/guest` with another email. Guest banner shows days left.
- [ ] **QR / customer menu:** open the manager's QR link, order a dish, see it on the waiter's Orders screen.
- [ ] **Payment:** Part 5.6.
- [ ] **Cleanup:** delete every test restaurant you made (Super Admin → **Restaurants & accounts**).

## Part 7. The phone app

- [ ] Open `Table secret/app.json` and check `extra.apiUrl` is `https://as-426-studios-2026.vercel.app`.
- [ ] In the `Table secret` folder run: `npx eas login`, then `npx eas build --platform android --profile preview`.
      The app needs this rebuild to get the new sign-in (restaurant code), forgot password, plans and QR screens.
- [ ] Install the build on a real Android phone and test: sign in, new order sound/vibration, push notification, plans
      screen, UPI QR with **Open my UPI app**, forgot password.
- [ ] **Back up the `Table secret` folder** (copy it to Google Drive or a USB drive). It is not in git, so if the
      laptop fails it is lost.
- [ ] iPhone needs an Apple Developer account (paid). Not needed for Android.

## Part 8. Before real customers

- [ ] Hostinger → your database → **Backups**: turn on automatic backups, and download one by hand now.
- [ ] Remove leftover test restaurants and accounts from the live database.
- [ ] Have a lawyer or accountant read the Terms, Privacy and Refund pages. They are sensible defaults, not legal advice.
- [ ] Decide your real support routine: who answers **Queries** in the Super Admin and the support email, and within
      what time (the pages promise a reply in 2 working days).
- [ ] Gmail can send roughly 500 emails a day. Fine for now. If you grow past that, ask me to switch to a proper email
      service.

## Things that are not covered (so you know)
- The email a signed-out person types when asking Mira a question is not verified.
- Waiters have no email, so they cannot reset their own password: their manager resets it.
- Everything was tested on a local test database. Part 6 is the first run on your real database, so expect to fix a
  small thing or two.
