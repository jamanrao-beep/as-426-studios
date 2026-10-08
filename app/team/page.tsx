import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { access } from "@/db/store";
import { redirect } from "next/navigation";
import Team from "./team";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireChatGPTUser("/team");

  try {
    const a = await access();

    if (a.mustChangePassword) {
      redirect("/change-password");
    }

    if (a.role === "waiter") {
      redirect("/team/orders");
    }

    if (!a.allowed && !a.owner) {
      return (
        <main className="access">
          <h1>Team access only</h1>
          <p>You do not have manager access to this workspace. Please contact Super Admin.</p>
          <a href="/login">Sign in with another account</a>
        </main>
      );
    }

    return (
      <Team
        owner={a.owner}
        studio={a.studio}
        email={a.email}
        assignedRestaurant={a.restaurantId}
        userRole={a.role || "admin"}
      />
    );
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return (
      <main className="access">
        <h1>The dashboard is unavailable</h1>
        <p>Please refresh and try again.</p>
      </main>
    );
  }
}
