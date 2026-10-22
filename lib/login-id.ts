// How a login ID looks to people versus how it is stored.
//
//   People see and type:   rahul@spice-route        (username @ restaurant code)
//   Stored in the database: rahul@spice-route.as426studios.com
//
// The stored form is a normal email-shaped address, so every check that expects an address keeps working. These two
// functions convert between them and are safe to use on the website too (no server code in here).
export const LOGIN_DOMAIN = "as426studios.com";

const SUFFIX = "." + LOGIN_DOMAIN;

// What to show people: `rahul@spice-route.as426studios.com` becomes `rahul@spice-route`. Older accounts
// (`name@as426studios.com`) and the Super Admin's email are left as they are.
export function shortLogin(login: string): string {
  const l = String(login || "");
  return l.toLowerCase().endsWith(SUFFIX) ? l.slice(0, l.length - SUFFIX.length) : l;
}

// What the server looks up: `rahul@spice-route` becomes `rahul@spice-route.as426studios.com`. Anything that already
// has a dot after the @ (a full address) is left alone.
export function fullLogin(input: string): string {
  const l = String(input || "").trim().toLowerCase();
  const at = l.lastIndexOf("@");
  if (at < 1) return l;
  const domain = l.slice(at + 1);
  return domain && !domain.includes(".") ? l + SUFFIX : l;
}

// The restaurant code inside a login ID, if it has one.
export function codeOf(login: string): string {
  const s = shortLogin(login);
  const at = s.lastIndexOf("@");
  return at > 0 && !s.slice(at + 1).includes(".") ? s.slice(at + 1) : "";
}
