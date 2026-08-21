import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardProfilePoints, loadPetProfile } from "@/lib/petProfile";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const petId = new URL(request.url).searchParams.get("pet_id");
  const data = await loadPetProfile(petId, profile.id);
  if (!data) return NextResponse.json({ error: "Pet not found." }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await request.json();
  const petId = body.pet_id;
  const module = body.module;
  const payload = body.payload || {};
  const reason = String(body.update_reason || "");
  const admin = createAdminClient();
  const { data: pet } = await admin.from("pets").select("*").eq("id", petId).eq("profile_id", profile.id).maybeSingle();
  if (!pet) return NextResponse.json({ error: "Pet not found." }, { status: 404 });

  if (module === "basic") {
    const { error } = await admin.from("pets").update({
      name: payload.name || pet.name,
      species: payload.species || pet.species,
      breed: payload.breed ?? pet.breed,
      birthday_year: payload.birthday_year === "" ? null : payload.birthday_year,
      birthday_month: payload.birthday_month === "" ? null : payload.birthday_month,
      birthday_day: payload.birthday_day === "" ? null : payload.birthday_day,
      weight_lbs: payload.weight_lbs === "" ? pet.weight_lbs : Number(payload.weight_lbs),
      weight_unit: payload.weight_unit || pet.weight_unit || "lbs",
      sex: payload.sex ?? pet.sex,
      microchipped: payload.microchipped === "" ? pet.microchipped : payload.microchipped === true || payload.microchipped === "yes",
      microchip_number: payload.microchip_number ?? pet.microchip_number,
      vet_clinic: payload.vet_clinic ?? pet.vet_clinic,
      notes: payload.notes ?? pet.notes,
      updated_at: new Date().toISOString(),
    }).eq("id", petId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, award: { points: 0 } });
  }

  const tables = { diet: "pet_diet", hygiene: "pet_hygiene", medical: "pet_medical", social: "pet_social" };
  if (!tables[module]) return NextResponse.json({ error: "Unknown module." }, { status: 400 });
  const current = await loadPetProfile(petId, profile.id);
  const before = current[module] || {};
  const row = { pet_id: petId, ...payload, updated_at: new Date().toISOString() };
  const { error } = await admin.from(tables[module]).upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const after = await loadPetProfile(petId, profile.id);
  const prog = after.progress[module] || 0;
  const firstPaid = (after.rewards || []).some((r) => r.module === module && r.first_bonus_paid);
  const kind = !firstPaid && prog >= 100 ? "first" : "update";
  let longevity = false;
  if (module === "diet" || module === "hygiene") {
    const productId = module === "diet" ? after.diet.food_product_id : after.hygiene.litter_product_id;
    if (productId) {
      const { data: prod } = await admin.from("product_catalog").select("is_longevity_partner").eq("id", productId).maybeSingle();
      longevity = !!prod?.is_longevity_partner;
    }
  }
  const changed = JSON.stringify(before) !== JSON.stringify(after[module]);
  const award = changed ? await awardProfilePoints({ userId: profile.id, petId, module, kind, reason, longevity }) : { points: 0, skipped: "unchanged" };
  return NextResponse.json({ ok: true, award, progress: after.progress });
}
