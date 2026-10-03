import { NextResponse } from "next/server";

interface StoredDesktopSession {
  sessionId: string;
  status: "authenticated" | "unregistered";
  shopId?: string;
  shop?: Record<string, unknown>;
  error?: string;
  createdAt: number;
}

// In-memory session store for desktop auth handoff (TTL 5 minutes)
const sessions = new Map<string, StoredDesktopSession>();

function sweepExpiredSessions() {
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      sessions.delete(key);
    }
  }
}

export async function POST(request: Request) {
  try {
    sweepExpiredSessions();
    const body = await request.json();
    const { sessionId, status = "authenticated", shopId, shop, error } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (status === "unregistered") {
      sessions.set(sessionId.trim(), {
        sessionId: sessionId.trim(),
        status: "unregistered",
        error: error || "No registered shop found",
        createdAt: Date.now(),
      });
      return NextResponse.json({ success: true });
    }

    if (!shopId || typeof shopId !== "string") {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    sessions.set(sessionId.trim(), {
      sessionId: sessionId.trim(),
      status: "authenticated",
      shopId: shopId.trim(),
      shop: shop || {},
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[desktop-session] POST error:", err);
    return NextResponse.json({ error: "Failed to store session" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    sweepExpiredSessions();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
    }

    const session = sessions.get(sessionId.trim());
    if (!session) {
      return NextResponse.json({ status: "pending" });
    }

    // Return session and consume it
    sessions.delete(sessionId.trim());

    if (session.status === "unregistered") {
      return NextResponse.json({
        status: "unregistered",
        error: session.error || "No registered shop found for this account.",
      });
    }

    return NextResponse.json({
      status: "authenticated",
      shopId: session.shopId,
      shop: session.shop,
    });
  } catch (err) {
    console.error("[desktop-session] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
