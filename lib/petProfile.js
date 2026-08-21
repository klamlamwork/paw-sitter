import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";

export const PROFILE_POINTS = {
  diet: { first: 400, update: 100, cooldown: 30, reasonMin: 25 },
  hygiene: { first: 400, update: 100, cooldown: 30, reasonMin: 25 },
  medical: { first: 400, update: 100, cooldown: 60, reasonMin: 10 },
  social: { first: 200, update: 80, cooldown: 30, reasonMin: 0 },
  longevity: { first: 200, update: 80, cooldown: 30, reasonMin: 0 },
  health: { first: 200, update: 80, cooldown: 0, reasonMin: 10, monthCap: 320 },
};
export const RELOG_MONTH_CAP = 1000;

export function displayAge(pet) {
  const year = Number(pet.birthday_year || 0);
  if (!year) {
    const y = Number(pet.age_years || 0);
    const m = Number(pet.age_months || 0);
    if (!y && !m) return "";
    return `${y ? `${y} yr` : ""} ${m ? `${m} mo` : ""}`.trim();
  }
  const now = new Date();
  let months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - (Number(pet.birthday_month) || 1));
  if (pet.birthday_day && now.getDate() < Number(pet.birthday_day) && Number(pet.birthday_month || 1) === now.getMonth() + 1) months -= 1;
  if (months < 0) months = 0;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

function filled(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!(v || "").toString().trim();
}

export function moduleProgress(pet, diet, hygiene, medical, social, episodes) {
  const dietNeed = [diet?.food_brand || diet?.food_product_name, diet?.feeding_style, diet?.feeder_type, diet?.water_source];
  const hygNeed = [hygiene?.floor_cleaner, hygiene?.bathing_product, hygiene?.nail_routine, hygiene?.brushing_routine];
  if (pet.species === "cat") hygNeed.push(hygiene?.litter_name || hygiene?.litter_product_id);
  const medNeed = [medical?.allergies, medical?.conditions, medical?.insurance_company];
  const socNeed = [social?.friendly_with, social?.play_toys?.length || social?.custom_toy];
  const pct = (arr) => Math.round((arr.filter(filled).length / Math.max(arr.length, 1)) * 100);
  return {
    diet: pct(dietNeed),
    hygiene: pct(hygNeed),
    medical: pct(medNeed),
    social: pct(socNeed),
    health: episodes?.length ? 100 : 0,
  };
}

async function monthPoints(admin, userId, reasonPrefix) {
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { data } = await admin.from("paw_point_ledger").select("delta, source_key, remark").eq("user_id", userId).eq("reason", "earn_profile").gt("delta", 0).gte("created_at", start.toISOString());
  return data || [];
}

export async function awardProfilePoints({ userId, petId, module, kind, reason = "", longevity = false }) {
  const admin = createAdminClient();
  const spec = PROFILE_POINTS[module];
  if (!spec) return { points: 0 };
  const { data: stamp } = await admin.from("pet_profile_rewards").select("*").eq("pet_id", petId).eq("module", module).maybeSingle();
  const rows = await monthPoints(admin, userId);
  const relogTotal = rows.filter((r) => /update|switch|episode/i.test(r.remark || "")).reduce((s, r) => s + Number(r.delta || 0), 0);
  const healthTotal = rows.filter((r) => r.source_key === "health").reduce((s, r) => s + Number(r.delta || 0), 0);

  let points = 0;
  let remark = "";
  if (kind === "first") {
    if (stamp?.first_bonus_paid) return { points: 0, skipped: "already_completed" };
    points = spec.first;
    remark = `${module} profile completed`;
  } else {
    if ((reason || "").trim().length < (spec.reasonMin || 0)) return { points: 0, skipped: "reason" };
    if (spec.cooldown && stamp?.last_rewarded_at) {
      const days = (Date.now() - new Date(stamp.last_rewarded_at).getTime()) / 86400000;
      if (days < spec.cooldown) return { points: 0, skipped: "cooldown", next: spec.cooldown - days };
    }
    if (module === "health" && healthTotal + spec.update > spec.monthCap) return { points: 0, skipped: "health_cap" };
    if (relogTotal + spec.update > RELOG_MONTH_CAP) return { points: 0, skipped: "month_cap" };
    points = spec.update;
    remark = `${module} profile update`;
  }

  let bonus = 0;
  if (longevity && (module === "diet" || module === "hygiene" || module === "longevity")) {
    const { data: lon } = await admin.from("pet_profile_rewards").select("*").eq("pet_id", petId).eq("module", "longevity").maybeSingle();
    if (kind === "first" && !lon?.first_bonus_paid) bonus = PROFILE_POINTS.longevity.first;
    if (kind === "update") {
      const lonDays = lon?.last_rewarded_at ? (Date.now() - new Date(lon.last_rewarded_at).getTime()) / 86400000 : 999;
      if (lonDays >= 30 && relogTotal + points + PROFILE_POINTS.longevity.update <= RELOG_MONTH_CAP) bonus = PROFILE_POINTS.longevity.update;
    }
  }

  if (points > 0) {
    await appendLedger({
      user_id: userId,
      delta: points,
      status: "available",
      reason: "earn_profile",
      source_key: module,
      remark: `${remark} (+${points})`,
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    });
    await admin.from("pet_profile_rewards").upsert({
      pet_id: petId,
      module,
      first_bonus_paid: kind === "first" ? true : !!stamp?.first_bonus_paid,
      last_rewarded_at: new Date().toISOString(),
    });
  }
  if (bonus > 0) {
    await appendLedger({
      user_id: userId,
      delta: bonus,
      status: "available",
      reason: "earn_profile",
      source_key: "longevity",
      remark: `Longevity partner bonus (+${bonus})`,
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    });
    await admin.from("pet_profile_rewards").upsert({
      pet_id: petId,
      module: "longevity",
      first_bonus_paid: true,
      last_rewarded_at: new Date().toISOString(),
    });
  }
  return { points, bonus };
}

export async function loadPetProfile(petId, userId) {
  const admin = createAdminClient();
  const { data: pet } = await admin.from("pets").select("*").eq("id", petId).eq("profile_id", userId).maybeSingle();
  if (!pet) return null;
  const [{ data: diet }, { data: hygiene }, { data: medical }, { data: social }, { data: episodes }, { data: rewards }] = await Promise.all([
    admin.from("pet_diet").select("*").eq("pet_id", petId).maybeSingle(),
    admin.from("pet_hygiene").select("*").eq("pet_id", petId).maybeSingle(),
    admin.from("pet_medical").select("*").eq("pet_id", petId).maybeSingle(),
    admin.from("pet_social").select("*").eq("pet_id", petId).maybeSingle(),
    admin.from("pet_health_episodes").select("*").eq("pet_id", petId).order("created_at", { ascending: false }).limit(20),
    admin.from("pet_profile_rewards").select("*").eq("pet_id", petId),
  ]);
  return {
    pet,
    diet: diet || {},
    hygiene: hygiene || {},
    medical: medical || {},
    social: social || {},
    episodes: episodes || [],
    rewards: rewards || [],
    progress: moduleProgress(pet, diet, hygiene, medical, social, episodes),
    age_label: displayAge(pet),
  };
}
