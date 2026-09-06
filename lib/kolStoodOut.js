import { createAdminClient } from "@/lib/supabase/admin";

export async function attachKolStoodOut(post) {
  if (!post?.id) return post;
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("shop_kol_posts").select("published_revision_id, pending_revision_id").eq("id", post.id).maybeSingle();
    const revisionId = row?.published_revision_id || row?.pending_revision_id;
    if (!revisionId) return post;
    const { data: revision, error } = await admin.from("shop_kol_post_revisions").select("stood_out").eq("id", revisionId).maybeSingle();
    if (error || !revision) return post;
    const stoodOut = Array.isArray(revision.stood_out) ? revision.stood_out : [];
    const optionIds = [...new Set(stoodOut.flatMap((item) => item?.option_ids || []).map((id) => String(id || "")).filter(Boolean))];
    const options = {};
    if (optionIds.length) {
      const { data: opts } = await admin.from("shop_rating_options").select("id, label, description, icon_url").in("id", optionIds);
      for (const opt of opts || []) options[String(opt.id)] = opt;
    }
    const ticksByProduct = {};
    for (const item of stoodOut) {
      const productId = String(item?.product_id || "");
      ticksByProduct[productId] = (item?.option_ids || []).map((id) => options[String(id)]).filter(Boolean);
    }
    return {
      ...post,
      products: (post.products || []).map((product) => ({
        ...product,
        ticks: ticksByProduct[String(product.id)] || [],
      })),
    };
  } catch {
    return post;
  }
}
