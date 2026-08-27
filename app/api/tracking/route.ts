import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tracking
 * Returns the current user's application tracking entries.
 *
 * POST /api/tracking
 * Creates or updates a tracking entry.
 *
 * DELETE /api/tracking
 * Removes a tracking entry.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ items: [] });
    }

    const { data } = await supabase
      .from("application_tracking")
      .select("*, opportunities(*)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { opportunityId, status, notes } = body;

    if (!opportunityId || !status) {
      return NextResponse.json({ error: "opportunityId and status required." }, { status: 400 });
    }

    const validStatuses = ["interested", "saved", "applied", "interview", "rejected", "accepted", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const { error } = await supabase
      .from("application_tracking")
      .upsert(
        {
          user_id: user.id,
          opportunity_id: opportunityId,
          status,
          notes: notes || null,
          applied_at: status === "applied" ? new Date().toISOString() : undefined,
        },
        { onConflict: "user_id,opportunity_id" }
      );

    if (error) {
      console.error("[Tracking] Error:", error);
      return NextResponse.json({ error: "Failed to update tracking." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId required." }, { status: 400 });
    }

    await supabase
      .from("application_tracking")
      .delete()
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
