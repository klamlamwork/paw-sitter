import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { KOL_LIMITS, KOL_ORPHAN_HOURS, KOL_UPLOAD_TTL_MINUTES } from "@/lib/kolPolicy";

async function assertOwnedActiveDraft(admin, { userId, postId }) {
  if (!postId) throw new Error("Create a KOL draft before uploading media.");
  const { data: post } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, source_type, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.author_profile_id !== userId) throw new Error("KOL draft not found.");
  if (post.status !== "draft") throw new Error("Media can be uploaded only to an active draft.");
  return post;
}

export async function createKolUploadSession({ userId, mediaKind, postId }) {
  const kind = mediaKind === "video" ? "video" : "image";
  const admin = createAdminClient();
  const post = await assertOwnedActiveDraft(admin, { userId, postId });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourly } = await admin
    .from("kol_upload_sessions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId)
    .gte("created_at", since);
  if ((hourly || 0) >= 20) throw new Error("Upload limit reached. Try again later.");

  const { count: images } = await admin
    .from("kol_upload_sessions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id)
    .eq("media_kind", "image")
    .in("status", ["open", "uploaded", "attached"]);
  const { count: videos } = await admin
    .from("kol_upload_sessions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id)
    .eq("media_kind", "video")
    .in("status", ["open", "uploaded", "attached"]);
  if (kind === "image" && (images || 0) >= KOL_LIMITS.maxImages) throw new Error("This post already has the maximum 10 images.");
  if (kind === "video" && (videos || 0) >= KOL_LIMITS.maxVideos) throw new Error("This post already has a video.");

  const sessionId = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const folder = `joyful-paws/kol/${userId}/${post.id}`;
  const expiresAt = new Date(Date.now() + KOL_UPLOAD_TTL_MINUTES * 60 * 1000).toISOString();
  const row = {
    id: sessionId,
    profile_id: userId,
    post_id: post.id,
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
  const { data: session } = await admin
    .from("kol_upload_sessions")
    .select("id, post_id, profile_id, folder, public_id, resource_type, max_bytes, max_duration_seconds, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new Error("Upload session not found.");
  if (!["open", "uploaded"].includes(session.status)) throw new Error("Upload session is no longer active.");
  if (extra.bytes && Number(extra.bytes) > Number(session.max_bytes || 0)) throw new Error("Uploaded file exceeds the allowed size.");
  if (session.resource_type === "video" && extra.duration_seconds && Number(extra.duration_seconds) > Number(session.max_duration_seconds || 0)) {
    throw new Error("Uploaded video exceeds the 90-second limit.");
  }
  const publicId = extra.public_id || `${session.folder}/${session.public_id}`;
  await admin.from("kol_upload_sessions").update({ status: "uploaded", uploaded_at: new Date().toISOString() }).eq("id", session.id);
  const { error } = await admin.from("shop_kol_post_media").insert({
    post_id: session.post_id,
    public_id: publicId,
    version: extra.version || null,
    resource_type: session.resource_type,
    bytes: extra.bytes || null,
    width: extra.width || null,
    height: extra.height || null,
    duration_seconds: extra.duration_seconds || null,
    lifecycle: "unattached",
  });
  if (error) throw error;
  return { post_id: session.post_id, public_id: publicId };
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
    await admin
      .from("shop_kol_post_media")
      .update({ lifecycle: "deleted" })
      .eq("public_id", `${session.folder}/${session.public_id}`)
      .eq("lifecycle", "unattached");
    deleted.push(session.id);
  }
  return deleted;
}
