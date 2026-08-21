import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardProfilePoints, loadPetProfile } from "@/lib/petProfile";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await request.json();
  const petId = body.pet_id;
  const notes = String(body.notes || "").trim();
  const eventType = String(body.event_type || "").trim();
  if (!petId || !eventType || notes.length < 10) {
    return NextResponse.json({ error: "Event type and notes (10+ characters) are required." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: pet } = await admin.from("pets").select("id").eq("id", petId).eq("profile_id", profile.id).maybeSingle();
  if (!pet) return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  const { error } = await admin.from("pet_health_episodes").insert({ pet_id: petId, event_type: eventType, notes });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const current = await loadPetProfile(petId, profile.id);
  const firstPaid = (current.rewards || []).some((r) => r.module === "health" && r.first_bonus_paid);
  const award = await awardProfilePoints({
    userId: profile.id,
    petId,
    module: "health",
    kind: firstPaid ? "update" : "first",
    reason: notes,
  });
  return NextResponse.json({ ok: true, award, episodes: current.episodes });
}
