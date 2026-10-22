// The help answers Mira gives, kept on the server so the phone app and the website always say the same thing.
// Change an answer here and both update. Prices come from the plan list in the database, never from this file.
export type Entry = {
  id: string;
  q: string; // shown as a suggested question
  keys: string[]; // words or phrases people use; longer phrases count for more
  a: string;
  who?: "manager" | "waiter" | "guest" | "anyone";
  suggest?: boolean;
};

export type HelpPlan = { label: string; price: number; strike: number; months: number; best: boolean };

const inr = (n: number) => "\u20b9" + n.toLocaleString("en-IN");
const savingPct = (p: { price: number; strike: number }) => (p.strike > p.price ? Math.round(((p.strike - p.price) / p.strike) * 100) : 0);

const plansAnswer = (plans: HelpPlan[]) => {
  if (!plans.length) return "Open Plan and billing to see the current plans and prices. Choose one and our team contacts you to complete payment, then activates it for you.";
  const line = plans.map((p) => `${p.label} ${inr(p.price)}${savingPct(p) > 0 ? ` (save ${savingPct(p)}%)` : ""}${p.best ? " (best value)" : ""}`).join(", ");
  return `Plans: ${line}. Open Plan and billing, choose one and our team contacts you to complete payment, then activates it for you.`;
};

export type Client = "app" | "web";

// Where things live differs between the phone app and the website, so a few answers have a website version.
const WEB: Record<string, string> = {
  what: "Table Secret is a QR menu and ordering system for restaurants. Guests scan the QR code on their table, browse your menu and order from their own phone. This workspace is for your team: managers run the menu, staff and reports, and waiters handle live orders and table requests.",
  flow: "A new order arrives under New. Click Accept order to confirm it, Start preparing when the kitchen begins, and Confirm delivered when the food reaches the table. Each step updates the guest's phone live.",
  cancel: "Open the order's three-dot menu and choose Cancel this order. You must pick or write a reason, and the guest sees that reason on their order. A cancelled order can't be restarted, so double check first.",
  alerts: "Turn on the bell in the Orders toolbar to hear a chime for each new order while this page is open. For alerts when the page is closed, install the phone app, sign in, and allow notifications.",
  requests: "Guests can tap Call waiter or Ask for the bill on the menu. It appears at the top of the Orders screen with the table number. Click Done once you have helped them.",
  filters: "On Orders, use the three-dot menu for Earlier unfinished, Order history (any date) and Cancelled orders. Use the magnifier to search by guest name, order number or table, and the New, In progress and Done tabs to filter by status.",
  today: "The tabs show today's orders by status and start fresh at midnight India time (IST). Click a tab to see just those orders.",
  addDish: "Open Menu manager and click Add dish. Fill in the name, price and category (add allergens, spice, taste and a description if you like), then click Save changes so it goes live for guests.",
  save: "Menu edits stay in a draft until you click Save changes at the top of Menu manager. After saving, guests see the new menu straight away. If you leave without saving, the draft is lost.",
  soldout: "In Menu manager, switch the dish's Available toggle off, then Save changes. Guests can no longer order it. Switch it back on when it's ready again.",
  edit: "In Menu manager click the pencil on the dish. You can change anything, and you'll find Delete inside the editor. Remember to click Save changes afterwards.",
  photo: "Yes. In the dish editor choose a photo from your computer. We shrink it automatically so the menu stays fast.",
  addWaiter: "Open Manage waiters and add a waiter. Enter their name and we create a login with a temporary password you can copy or share. They sign in with it and choose their own password first.",
  manageWaiter: "In Manage waiters, each waiter has buttons to reset their password (you get a new temporary one), suspend them (they're signed out and can't sign in until you reactivate) or remove them for good.",
  reports: "Open Monthly sales, Dish performance, Customer reviews and Dish insights in the sidebar. Monthly sales shows sales by day, Dish performance shows your best seller, top earner, top rated and unsold dishes, and Dish insights summarises yesterday.",
  reviews: "Guest feedback arrives privately under Customer reviews, newest first. Mark each review as read so nothing is missed. Dish star ratings also feed the Top rated dish in Dish performance.",
  settings: "Open Restaurant settings in the sidebar. You can edit the name, tagline and menu note, and switch ordering off when you're closed or too busy. Guests can still read the menu but can't place orders.",
  qr: "Open QR & customer link in the sidebar. Print the QR code for each table, or copy and share the link. Guests scan it, see your menu and order, with no app to install.",
  trial: "Once you're approved, you get a 14-day free trial (7 days plus a 7-day welcome bonus) with everything unlocked. The countdown is the pill at the top right of the dashboard; click it to open Plan and billing. When it ends you choose a plan to continue. Your data is kept.",
  password: "Waiters: use the Password button at the top right. If you forgot your password, managers tap Forgot your password? on the sign-in screen: we email a 6-digit code to the email you gave us and you choose a new one. A waiter has no email of their own, so they ask their manager to reset it from Manage waiters.",
  signOut: "Click Sign out at the top right.",
  tour: "The guided tour runs in the phone app: open the side menu and choose Take the tour. On the website, ask me anything any time.",
  offline: "Orders need an internet connection to arrive live. The Orders screen shows 'Offline · retrying' and recovers by itself when the connection returns.",
  contact: "Ask me below! If I can't answer, send it to our team and the question goes straight to our inbox with your email, and we'll reply by email.",
};

export function buildKb(plans: HelpPlan[], client: Client = "app"): Entry[] {
  const list = buildApp(plans);
  if (client === "app") return list;
  return list.map((e) => ({ ...e, a: WEB[e.id] ?? e.a.replace(/tap/g, "click").replace(/Tap/g, "Click") }));
}

function buildApp(plans: HelpPlan[]): Entry[] {
  return [
  {
    id: "what",
    q: "What is Table Secret?",
    keys: ["what is", "about", "table secret", "what does this app do", "purpose", "overview", "as 426", "studios"],
    a: "Table Secret is a QR menu and ordering system for restaurants. Guests scan the QR code on their table, browse your menu and order from their own phone, with nothing to install. This app is for your team: managers run the menu, waiters and reports, and waiters handle live orders and table requests.",
    suggest: true,
  },
  {
    id: "who",
    q: "Who is this app for?",
    keys: ["who is this for", "who can use", "customers", "guests use", "can customers", "diners", "role", "roles", "manager and waiter", "super admin"],
    a: "The app is for restaurant managers and waiters. Customers never need the app; they scan your table QR code and use the website menu. The Super Admin (our team) works on the website, not in this app.",
  },
  {
    id: "flow",
    q: "How does an order move through the app?",
    keys: ["order flow", "order status", "accept order", "prepare", "preparing", "deliver", "delivered", "placed", "stages", "process order", "handle order", "how do i take"],
    a: "A new order arrives as Placed. Tap Accept to confirm it, Start preparing when the kitchen begins, and Confirm delivered when the food reaches the table. Each step updates the guest's phone live.",
    who: "waiter",
    suggest: true,
  },
  {
    id: "cancel",
    q: "How do I cancel an order?",
    keys: ["cancel", "void", "reject order", "wrong order", "remove order", "refuse"],
    a: "Open the order and tap Cancel. You must pick or write a reason, and the guest sees that reason on their order. A cancelled order can't be restarted, so double check before confirming.",
  },
  {
    id: "alerts",
    q: "Why didn't I get an order alert?",
    keys: ["alert", "notification", "notifications", "buzz", "vibrate", "vibration", "sound", "ring", "not receiving", "push", "ping", "missed order"],
    a: "While the app is open the phone vibrates for every new order if 'Alert buzz for new orders' is on (top of the Orders screen). For alerts when the app is closed, allow notifications for Table Secret in your phone's settings, keep internet on, and make sure you are signed in on this phone. Battery saver modes can also block notifications.",
    suggest: true,
  },
  {
    id: "requests",
    q: "What are Call waiter and Bill requests?",
    keys: ["call waiter", "bill", "request", "ask for bill", "table request", "service request", "help from guest", "done button"],
    a: "Guests can tap Call waiter or Ask for the bill on the menu. It pops up at the top of the Orders screen with the table number. Tap Done once you have helped them.",
    who: "waiter",
  },
  {
    id: "filters",
    q: "How do I find an old order?",
    keys: ["search", "find order", "filter", "history", "old order", "earlier", "yesterday", "date", "past orders", "previous orders", "unfinished"],
    a: "On Orders, use 'Earlier unfinished' for older orders that were never finished, and 'Order history' to pick any date. You can also search by guest name, order number or table, filter by table, and tap a status tile to see just those orders.",
  },
  {
    id: "today",
    q: "When do today's counts reset?",
    keys: ["reset", "midnight", "today's count", "counts", "tiles", "numbers", "kpi", "timezone", "ist"],
    a: "The tiles count today's orders by status and start fresh at midnight India time (IST). Tap a tile to show only those orders.",
  },
  {
    id: "addDish",
    q: "How do I add a dish?",
    keys: ["add dish", "new dish", "create dish", "add item", "add food", "add menu", "menu item", "new item", "put dish"],
    a: "Go to the Menu tab and tap '+ Add dish'. Fill in the name, price and category (add allergens, spice, taste and a description if you like), then tap Save changes at the bottom so it goes live for guests.",
    who: "manager",
    suggest: true,
  },
  {
    id: "save",
    q: "Why isn't my menu change showing for guests?",
    keys: ["save", "draft", "not showing", "not visible", "go live", "publish", "changes not", "update menu", "menu not updating"],
    a: "Menu edits stay in a draft until you tap 'Save changes' at the bottom of the Menu screen. After saving, guests see the new menu straight away. If you leave without saving, the draft is lost.",
    who: "manager",
  },
  {
    id: "soldout",
    q: "How do I mark a dish sold out?",
    keys: ["sold out", "unavailable", "out of stock", "hide dish", "available", "switch", "toggle dish", "not available"],
    a: "On the Menu tab, flip the Available switch of that dish off, then Save changes. Guests can no longer order it. Flip it back on when it's ready again.",
    who: "manager",
  },
  {
    id: "edit",
    q: "How do I edit or delete a dish?",
    keys: ["edit dish", "change price", "delete dish", "remove dish", "update dish", "change dish", "rename", "price"],
    a: "On the Menu tab tap Edit on the dish. You can change anything, and you'll find Delete inside the editor. Remember to tap Save changes afterwards.",
    who: "manager",
  },
  {
    id: "photo",
    q: "Can I add a photo to a dish?",
    keys: ["photo", "picture", "image", "pic", "upload", "camera", "gallery"],
    a: "Yes. In the dish editor tap the photo area to take a picture or choose one from your gallery. We shrink it automatically so the menu stays fast. Photos are locked in the guest sandbox; they unlock once you register your restaurant.",
    who: "manager",
  },
  {
    id: "secret",
    q: "What is a secret dish?",
    keys: ["secret", "secret dish", "hidden dish", "unlock", "special dish", "chef special", "hidden"],
    a: "A secret dish is hidden from the normal menu. Guests discover it with the 'Unlock the secret' button on your menu page. Turn on the Secret switch in the dish editor to make one.",
    who: "manager",
  },
  {
    id: "addWaiter",
    q: "How do I add a waiter?",
    keys: ["add waiter", "new waiter", "create waiter", "staff", "team", "add staff", "waiter account", "employee", "hire", "invite waiter"],
    a: "Open the Team tab and tap Add waiter. Enter their name and we create a login with a temporary password you can copy or share. They sign in with it and choose their own password on first sign-in.",
    who: "manager",
    suggest: true,
  },
  {
    id: "addManager",
    q: "Can I add another manager?",
    keys: ["add manager", "another manager", "new manager", "second manager", "co-owner", "partner", "owner account", "manager request", "propose manager"],
    a: "Yes, but the Super Admin has to approve it. Open Add a manager, enter their name, a login name and their real email, and send it. Once it is approved they get their login details by email and choose their own password. Waiters are different: you add those yourself with no approval, and waiters cannot add anyone.",
    who: "manager",
  },
  {
    id: "manageWaiter",
    q: "How do I reset, suspend or remove a waiter?",
    keys: ["reset password", "forgot waiter", "suspend", "remove waiter", "delete waiter", "block waiter", "waiter left", "disable waiter", "waiter forgot"],
    a: "On the Team tab, each waiter has buttons to reset their password (you get a new temporary one), suspend them (they're signed out and can't sign in until you reactivate) or remove them for good.",
    who: "manager",
  },
  {
    id: "waiterSees",
    q: "What can waiters see?",
    keys: ["waiter see", "waiter access", "permissions", "waiter permission", "restricted", "waiter cannot", "waiter can"],
    a: "Waiters only see live orders, order history and table requests. They never see sales, reports, menu editing or other staff.",
    who: "manager",
  },
  {
    id: "reports",
    q: "Where do I see my sales and reports?",
    keys: ["sales", "report", "reports", "analytics", "insights", "revenue", "income", "earn", "money", "statistics", "performance", "best seller", "chart"],
    a: "Open the Insights tab. This month's sales are at the top, and below are four reports: Monthly sales (by day with a chart), Dish performance (best seller, top earner, top rated, unsold dishes), Customer reviews, and Daily insights, a summary of yesterday.",
    who: "manager",
    suggest: true,
  },
  {
    id: "reviews",
    q: "Where do customer reviews appear?",
    keys: ["review", "reviews", "feedback", "rating", "ratings", "stars", "complaint", "comments"],
    a: "Guest feedback arrives privately under Insights > Customer reviews, newest first. Tap to mark each review as read so nothing is missed. Dish star ratings also feed the Top rated dish in Dish performance.",
    who: "manager",
  },
  {
    id: "settings",
    q: "How do I change my restaurant's name or pause ordering?",
    keys: ["restaurant name", "tagline", "settings", "pause ordering", "stop ordering", "closed", "busy", "close restaurant", "turn off ordering", "menu note", "details"],
    a: "Open the side menu (three lines, top left) > Restaurant details. You can edit the name, tagline and menu note, and switch ordering off when you're closed or too busy. Guests can still read the menu but can't place orders.",
    who: "manager",
  },
  {
    id: "qr",
    q: "Where is my QR code?",
    keys: ["qr", "qr code", "scan", "table qr", "link", "customer link", "menu link", "print", "share menu", "url"],
    a: "Open the side menu > QR & customer link. Print the QR code for each table, or copy and share the link. Guests scan it, see your menu and order, with no app to install.",
    who: "manager",
    suggest: true,
  },
  {
    id: "guestMode",
    q: "What is guest mode?",
    keys: ["guest mode", "guest", "test", "try", "demo", "sandbox", "trial as guest", "limited access", "free week", "explore"],
    a: "Guest mode lets you try the app free for 7 days with a sample restaurant. You verify your email with a 6-digit code. Limits: up to 12 dishes and 1 waiter, and some features (like photos and plans) show a 🔒 until you register. Guest data is removed after the week.",
    who: "guest",
    suggest: true,
  },
  {
    id: "guestCode",
    q: "I did not get my email code",
    keys: ["code", "otp", "verification", "verify", "email code", "no email", "didn't get", "not received", "resend", "6 digit", "spam"],
    a: "Check your spam or promotions folder, and make sure the email is typed correctly. Codes can take a minute and work for 10 minutes. You can ask for a new one after a minute, up to 5 per hour. If the email still doesn't come, send us a question below.",
  },
  {
    id: "register",
    q: "How do I register my restaurant?",
    keys: ["register", "sign up", "signup", "join", "new restaurant", "create account", "get started", "onboard", "apply", "registration"],
    a: "Tap 'Join the Table Secret team' and fill in 4 short steps: about you, your restaurant and location, your username, and a plan (or the free trial). Our team reviews it and emails you your restaurant code when you're approved. Then you sign in with your restaurant code, username and password.",
    suggest: true,
  },
  {
    id: "loginId",
    q: "What is my login ID?",
    keys: ["login id", "username", "restaurant code", "code", "login", "sign in", "log in", "email to sign in", "@as426studios", "which email", "cant login", "can't login", "cannot login", "unable to login"],
    a: "You sign in with your restaurant code and your username, for example code spice-route and username asha. Together they make your login ID, asha@spice-route.as426studios.com, which you can also type in full. It isn't a real mailbox; our emails go to the contact email you gave when registering. Your restaurant code comes in the approval email, and your manager can tell your waiters theirs. A username only has to be unique inside one restaurant, so two restaurants can each have an asha.",
    suggest: true,
  },
  {
    id: "approval",
    q: "How long does approval take?",
    keys: ["approval", "approve", "approved", "pending", "waiting", "how long", "review", "request status", "under review", "not approved"],
    a: "Our team reviews each registration and emails your contact address as soon as it's approved, then you can sign in. Until then, signing in shows that your request is under review. Check your spam folder if you hear nothing.",
  },
  {
    id: "trial",
    q: "How does the free trial work?",
    keys: ["trial", "free trial", "7 day", "14 day", "bonus", "free", "countdown", "timer", "days left", "trial ends", "expire", "expired"],
    a: "Once you're approved, you get a 14-day free trial (7 days plus a 7-day welcome bonus) with everything unlocked. The countdown is at the top right of the screen; tap it to pick a plan. When it ends, the app asks you to choose a plan to continue. Your data is kept.",
    suggest: true,
  },
  {
    id: "plans",
    q: "What are the plans and prices?",
    keys: ["plan", "plans", "price", "pricing", "cost", "how much", "subscription", "monthly", "yearly", "half yearly", "pay", "payment", "buy", "upgrade", "billing", "charge", "fee", "discount"],
    a: plansAnswer(plans),
    suggest: true,
  },
  {
    id: "password",
    q: "How do I change or reset my password?",
    keys: ["password", "change password", "forgot password", "reset", "forgot", "new password", "temporary password", "lost password"],
    a: "Change it any time from the side menu > Account > Change password (waiters: Account at the top right). If you forgot it, managers tap Forgot your password? on the sign-in screen: enter your restaurant code and username, we email a 6-digit code to the email you gave us, and you choose a new password. A waiter has no email of their own, so they ask their manager to reset it from the Team tab.",
  },
  {
    id: "signedOut",
    q: "Why was I signed out?",
    keys: ["signed out", "logged out", "log out", "kicked", "session", "removed", "suspended", "access removed", "account removed", "deleted"],
    a: "You are signed out automatically when an admin removes or suspends your account, when you change your password on another device, or when your guest week ends. The message on screen says which. If you think it's a mistake, ask your manager or send us a question below.",
  },
  {
    id: "signOut",
    q: "How do I sign out?",
    keys: ["sign out", "logout", "log me out", "switch account", "different account", "another account"],
    a: "Managers: side menu (three lines, top left) > Sign out. Waiters: tap Account at the top right > Sign out.",
  },
  {
    id: "offline",
    q: "Does it work offline?",
    keys: ["offline", "no internet", "internet", "network", "connection", "wifi", "slow", "retrying", "can't reach", "cannot connect"],
    a: "Orders need an internet connection to arrive live. The Orders screen shows 'Offline · retrying' and recovers by itself when the connection returns. Customers can download your menu on their phone so they can still read it with weak signal.",
  },
  {
    id: "tour",
    q: "Can I see the tour again?",
    keys: ["tour", "tutorial", "guide", "walkthrough", "show me around", "how to use", "help me learn", "demo again", "replay"],
    a: "Yes! Managers: side menu > Take the tour. Waiters: Account > Take the tour with Mira. I'll walk through every feature again.",
    suggest: true,
  },
  {
    id: "languages",
    q: "Which languages are supported?",
    keys: ["language", "languages", "hindi", "tamil", "translate", "english", "regional"],
    a: "The staff app is in English. The customer menu website can be switched between several languages by guests.",
  },
  {
    id: "dark",
    q: "Is there a dark theme?",
    keys: ["dark", "dark mode", "night mode", "theme", "colour", "color", "light mode", "appearance"],
    a: "Guests can switch between light and dark on the customer menu. The staff app uses a clean light look to stay easy to read in busy kitchens.",
  },
  {
    id: "data",
    q: "Is my data safe?",
    keys: ["secure", "security", "safe", "privacy", "data", "private", "encrypted", "backup", "hacked", "who can see"],
    a: "Yes. Your restaurant's data is stored in our private database and only your own team's accounts can see it. Passwords are stored encrypted, not in plain text, and the Super Admin can remove any account instantly if needed.",
  },
  {
    id: "devices",
    q: "Can I use it on more than one phone?",
    keys: ["two phones", "multiple devices", "more than one", "another phone", "same account", "tablet", "ipad", "iphone", "android", "both"],
    a: "Yes. The same login works on several phones, on both iPhone and Android. Each phone just needs to sign in once. Notifications go to every phone signed in.",
  },
  {
    id: "update",
    q: "The app says update required",
    keys: ["update", "new version", "outdated", "maintenance", "paused", "unavailable", "disabled", "switched off", "app is off"],
    a: "Our team can pause the app for maintenance, switch off a single feature, or ask for an update. Update from the Play Store or App Store when asked. If it says maintenance, try again in a little while.",
  },
  {
    id: "contact",
    q: "How do I contact the team?",
    keys: ["contact", "support", "help", "email us", "talk to", "human", "call", "phone number", "customer care", "complaint", "issue", "problem", "bug", "not working", "error"],
    a: "Ask me below! If I can't answer, tap 'Send this to our team' and the question goes straight to our inbox with your email, and we'll reply by email.",
  },
];
}
