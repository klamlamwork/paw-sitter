import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardProfilePoints, basicChangedForPoints, basicComplete, loadPetProfile } from "@/lib/petProfile";

export const dynamic = "force-dynamic";

function pickModule(row) {
  const skip = ["id", "pet_id", "created_at", "updated_at"];
  const out = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    if (!skip.includes(k)) out[k] = v;
  });
  return out;
}

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
    const next = {
      name: payload.name || pet.name,
      species: payload.species || pet.species,
      breed: payload.breed ?? pet.breed,
      birthday_year: payload.birthday_year === "" || payload.birthday_year == null ? pet.birthday_year : Number(payload.birthday_year),
      birthday_month: payload.birthday_month === "" || payload.birthday_month == null ? pet.birthday_month : Number(payload.birthday_month),
      birthday_day: payload.birthday_day === "" || payload.birthday_day == null ? pet.birthday_day : Number(payload.birthday_day),
      weight_lbs: payload.weight_lbs === "" || payload.weight_lbs == null ? pet.weight_lbs : Number(payload.weight_lbs),
      weight_unit: payload.weight_unit || pet.weight_unit || "lbs",
      sex: payload.sex ?? pet.sex,
      is_spayed_neutered: payload.is_spayed_neutered === undefined ? pet.is_spayed_neutered : payload.is_spayed_neutered,
      medications: payload.medications ?? pet.medications,
      notes: payload.notes ?? pet.notes,
      photo_url: payload.photo_url ?? pet.photo_url,
      microchipped: payload.microchipped === "" ? pet.microchipped : payload.microchipped === true || payload.microchipped === "yes",
      microchip_number: payload.microchip_number ?? pet.microchip_number,
      vet_clinic: payload.vet_clinic ?? pet.vet_clinic,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("pets").update(next).eq("id", petId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: saved } = await admin.from("pets").select("*").eq("id", petId).single();
    const firstPaid = (await loadPetProfile(petId, profile.id)).rewards.some((r) => r.module === "basic" && r.first_bonus_paid);
    let award = { points: 0 };
    if (!firstPaid && basicComplete(saved)) {
      award = await awardProfilePoints({ userId: profile.id, petId, module: "basic", kind: "first" });
    } else if (firstPaid && basicChangedForPoints(pet, saved)) {
      award = await awardProfilePoints({ userId: profile.id, petId, module: "basic", kind: "update" });
    }
    return NextResponse.json({ ok: true, award });
  }

  const tables = { diet: "pet_diet", hygiene: "pet_hygiene", medical: "pet_medical", social: "pet_social" };
  if (!tables[module]) return NextResponse.json({ error: "Unknown module." }, { status: 400 });
  const current = await loadPetProfile(petId, profile.id);
  const before = pickModule(current[module] || {});
  const row = { pet_id: petId, ...payload, updated_at: new Date().toISOString() };
  const { error } = await admin.from(tables[module]).upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const afterFull = await loadPetProfile(petId, profile.id);
  const after = pickModule(afterFull[module] || {});
  const prog = afterFull.progress[module] || 0;
  const firstPaid = (afterFull.rewards || []).some((r) => r.module === module && r.first_bonus_paid);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  let kind = null;
  if (!firstPaid && prog >= 100) kind = "first";
  else if (changed) kind = "update";
  let longevity = false;
  if (module === "diet" || module === "hygiene") {
    const productId = module === "diet" ? afterFull.diet.food_product_id : afterFull.hygiene.litter_product_id;
    if (productId) {
      const { data: prod } = await admin.from("product_catalog").select("is_longevity_partner").eq("id", productId).maybeSingle();
      longevity = !!prod?.is_longevity_partner;
    }
  }
  const productChanged = module === "diet"
    ? before.food_product_id !== after.food_product_id || before.food_brand !== after.food_brand
    : module === "hygiene"
      ? before.litter_product_id !== after.litter_product_id
      : false;
  const needReview = productChanged && (module === "diet" || module === "hygiene");
  const awardReason = needReview ? reason : (reason || "updated");
  if (needReview && awardReason.trim().length < 25 && kind === "update") {
    return NextResponse.json({ ok: true, award: { points: 0, skipped: "reason" }, progress: afterFull.progress, hint: "Write 25+ characters to earn Switch & Earn points." });
  }
  const award = kind ? await awardProfilePoints({ userId: profile.id, petId, module, kind, reason: awardReason, longevity }) : { points: 0, skipped: "unchanged" };
  return NextResponse.json({ ok: true, award, progress: afterFull.progress });
}
