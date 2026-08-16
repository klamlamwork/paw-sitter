import { createAdminClient } from "@/lib/supabase/admin";

const FULL_SELECT =
  "id, stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled, platform_fee_pct, updated_at";
const MIN_SELECT = "id, stripe_enabled, platform_fee_pct, updated_at";

function withDefaults(row) {
  if (!row) return null;
  return {
    id: row.id,
    stripe_enabled: !!row.stripe_enabled,
    card_enabled: row.card_enabled ?? !!row.stripe_enabled,
    etransfer_enabled: row.etransfer_enabled ?? true,
    pay_later_enabled: row.pay_later_enabled ?? true,
    platform_fee_pct: row.platform_fee_pct ?? 10,
    updated_at: row.updated_at || null,
  };
}

function missingMethodCols(error) {
  const msg = String(error?.message || "");
  return /card_enabled|etransfer_enabled|pay_later_enabled/.test(msg);
}

export async function ensureSitterPaymentSettings() {
  const admin = createAdminClient();

  let { data, error } = await admin.from("sitter_payments").select(FULL_SELECT).limit(1).maybeSingle();
  if (error && missingMethodCols(error)) {
    ({ data, error } = await admin.from("sitter_payments").select(MIN_SELECT).limit(1).maybeSingle());
  }
  if (error) throw error;
  if (data) return withDefaults(data);

  const fullInsert = {
    stripe_enabled: false,
    card_enabled: false,
    etransfer_enabled: true,
    pay_later_enabled: true,
    platform_fee_pct: 10,
    updated_at: new Date().toISOString(),
  };
  let inserted = await admin.from("sitter_payments").insert(fullInsert).select(FULL_SELECT).single();
  if (inserted.error && missingMethodCols(inserted.error)) {
    inserted = await admin
      .from("sitter_payments")
      .insert({ stripe_enabled: false, platform_fee_pct: 10, updated_at: new Date().toISOString() })
      .select(MIN_SELECT)
      .single();
  }
  if (inserted.error) throw inserted.error;
  return withDefaults(inserted.data);
}

export async function saveSitterPaymentSettings(methods) {
  const admin = createAdminClient();
  const next = {
    card_enabled: !!methods.card_enabled,
    etransfer_enabled: !!methods.etransfer_enabled,
    pay_later_enabled: !!methods.pay_later_enabled,
    stripe_enabled: !!methods.card_enabled,
    updated_at: new Date().toISOString(),
  };

  const current = await ensureSitterPaymentSettings();
  let { data, error } = await admin.from("sitter_payments").update(next).eq("id", current.id).select(FULL_SELECT).single();
  if (error && missingMethodCols(error)) {
    ({ data, error } = await admin
      .from("sitter_payments")
      .update({ stripe_enabled: next.stripe_enabled, updated_at: next.updated_at })
      .eq("id", current.id)
      .select(MIN_SELECT)
      .single());
  }
  if (error) throw error;
  return withDefaults(data);
}
