import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { KOL_LIMITS, KOL_ORPHAN_HOURS, KOL_UPLOAD_TTL_MINUTES } from "@/lib/kolPolicy";

export async function createKolUploadSession({ userId, mediaKind, postId }) {
  const kind = mediaKind === "video" ? "video" : "image";
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("kol_upload_sessions").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since);
  if ((count || 0) >= 20) throw new Error("Upload limit reached. Try again later.");

  const sessionId = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const folder = `joyful-paws/kol/${userId}/${sessionId}`;
  const expiresAt = new Date(Date.now() + KOL_UPLOAD_TTL_MINUTES * 60 * 1000).toISOString();
  const row = {
    id: sessionId,
    profile_id: userId,
    post_id: postId || null,
    media_kind: kind,
    status: "open",
    public_id: publicId,
    folder,
    resource_type: kind,
    max_bytes: kind === "video" ? KOL_LIMITS.videoMaxBytes : KOL_LIMITS.imageMaxBytes,
    max_duration_seconds: kind === "video" ? KOL_LIMITS.videoMaxSeconds : null,
    expires_at: expiresAt,
  };
  const { error } = await admin.from("kol_upload_sessions").insert(row);
  if (error) throw error;
  return row;
}

export async function markKolUploaded(sessionId, extra = {}) {
  const admin = createAdminClient();
  await admin.from("kol_upload_sessions").update({
    status: "uploaded",
    uploaded_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (extra.public_id) {
    await admin.from("shop_kol_post_media").insert({
      post_id: extra.post_id || null,
      public_id: extra.public_id,
      version: extra.version || null,
      resource_type: extra.resource_type || "image",
      bytes: extra.bytes || null,
      width: extra.width || null,
      height: extra.height || null,
      duration_seconds: extra.duration_seconds || null,
      lifecycle: "unattached",
    });
  }
}

export async function cleanupOrphanKolUploads() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - KOL_ORPHAN_HOURS * 3600 * 1000).toISOString();
  const { data: sessions } = await admin
    .from("kol_upload_sessions")
    .select("id, public_id, folder, resource_type")
    .in("status", ["open", "uploaded"])
    .lt("created_at", cutoff);
  const deleted = [];
  for (const session of sessions || []) {
    await admin.from("kol_upload_sessions").update({ status: "expired" }).eq("id", session.id);
    await admin.from("shop_kol_post_media").update({ lifecycle: "deleted" }).eq("public_id", `${session.folder}/${session.public_id}`).eq("lifecycle", "unattached");
    deleted.push(session.id);
  }
  return deleted;
}
