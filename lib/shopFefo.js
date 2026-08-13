import { createClient } from "@/lib/supabase/client";

/** Deduct qty FEFO. Returns remaining unallocated (0 = fully allocated). */
export async function allocateVariantFefo(variantId, qty) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shop_allocate_fefo", {
    p_variant_id: variantId,
    p_qty: qty,
  });
  if (error) return { ok: false, remaining: qty, error: error.message };
  const remaining = Number(data) || 0;
  return { ok: remaining === 0, remaining, error: remaining ? "Insufficient sellable stock" : null };
}

export async function refreshBatchExpiryStatus() {
  const supabase = createClient();
  return supabase.rpc("refresh_batch_expiry_status");
}
