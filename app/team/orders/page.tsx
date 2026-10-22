import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { orderAccess } from "@/db/store";
import { redirect } from "next/navigation";
import WaiterWorkspace from "../waiter-workspace";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireChatGPTUser("/team/orders");

  try {
    const a = await orderAccess();

    if (a.mustChangePassword) {
      redirect("/change-password");
    }

    if (a.allowed) {
      return (
        <WaiterWorkspace
          email={a.email}
          name={a.name || a.email}
          assignedRestaurant={a.restaurantId}
          restaurantName={a.restaurantName || a.restaurantId || ""}
          isWaiter={a.role === "waiter"}
        />
      );
    }

    if (a.blocked) {
      return (
        <main className="access">
          <h1>{a.blocked.code === "maintenance" ? "Back in a moment" : "Workspace unavailable"}</h1>
          <p>{a.blocked.code === "plan_expired" ? "Your restaurant's plan has ended. Please ask your manager to choose a plan." : a.blocked.message}</p>
          <a href="/api/auth/logout?return_to=/login">Sign out</a>
        </main>
      );
    }

    return (
      <main className="access">
        <h1>Order access required</h1>
        <p>Ask your restaurant manager to assign your account as a waiter.</p>
        <a href="/login">Sign in with a different account</a>
      </main>
    );
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return (
      <main className="access">
        <h1>Orders are unavailable</h1>
        <p>Please refresh to retry.</p>
      </main>
    );
  }
}
