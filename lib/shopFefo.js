import { createClient } from "@/lib/supabase/client";

/** Preview FEFO pick without reserving (uses allocate_fefo p_commit=false) */
export async function previewFefo(variantId, qty = 1) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("allocate_fefo", {
    p_variant_id: variantId,
    p_qty: qty,
    p_commit: false,
    p_created_by: null,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

/** Reserve FEFO lots for checkout (p_commit=true) */
export async function reserveFefo(variantId, qty, createdBy) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("allocate_fefo", {
    p_variant_id: variantId,
    p_qty: qty,
    p_commit: true,
    p_created_by: createdBy || null,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}
