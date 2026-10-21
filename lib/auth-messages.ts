export function signedOutMessage(reason: string) {
  switch (reason) {
    case "removed":
      return "Your access was removed by the admin, so you have been signed out.";
    case "suspended":
      return "Your account was suspended by the admin, so you have been signed out.";
    case "revoked":
      return "Your sign-in details were changed by the admin. Please sign in again.";
    case "expired":
      return "Your guest week has ended. Register your restaurant to keep going.";
    default:
      return "Please sign in.";
  }
}
