import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db/store";

export const dynamic = "force-dynamic";

// Who is signed in? Used by the mobile app to validate a stored session on launch.
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    let restaurantName = "";
    if (user.restaurantId) {
      const r = await db()
        .prepare("SELECT name FROM restaurants WHERE id = ?")
        .bind(user.restaurantId)
        .first<{ name: string }>();
      restaurantName = r?.name || "";
    }

    return NextResponse.json(
      {
        user: {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantName,
          mustChangePassword: !!user.mustChangePassword,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ error: "Couldn’t verify your session." }, { status: 503 });
  }
}
