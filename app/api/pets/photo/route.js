import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensurePetPhotosBucket(admin) {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.id === "pet-photos" || b.name === "pet-photos");
  if (exists) return;
  await admin.storage.createBucket("pet-photos", {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
  });
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const petId = String(form.get("pet_id") || "").trim();
    if (!petId) return NextResponse.json({ error: "Missing pet_id." }, { status: 400 });
    if (!file || typeof file === "string" || !file.size) {
      return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: pet } = await admin.from("pets").select("id").eq("id", petId).eq("profile_id", profile.id).maybeSingle();
    if (!pet) return NextResponse.json({ error: "Pet not found." }, { status: 404 });

    await ensurePetPhotosBucket(admin);

    const rawName = file.name || "photo.jpg";
    const ext = (rawName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${profile.id}/${petId}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || (ext === "png" ? "image/png" : "image/jpeg");

    let bucket = "pet-photos";
    let { error: upErr } = await admin.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      bucket = "inbox-photos";
      const retry = await admin.storage.from(bucket).upload(`pets/${path}`, bytes, { contentType, upsert: true });
      if (retry.error) throw upErr;
      const publicUrl = admin.storage.from(bucket).getPublicUrl(`pets/${path}`).data?.publicUrl || "";
      if (!publicUrl) throw new Error("Could not get photo URL.");
      const { error: saveErr } = await admin.from("pets").update({ photo_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", petId).eq("profile_id", profile.id);
      if (saveErr) throw saveErr;
      return NextResponse.json({ ok: true, photo_url: publicUrl });
    }

    const publicUrl = admin.storage.from(bucket).getPublicUrl(path).data?.publicUrl || "";
    if (!publicUrl) throw new Error("Could not get photo URL.");
    const { error: saveErr } = await admin.from("pets").update({ photo_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", petId).eq("profile_id", profile.id);
    if (saveErr) throw saveErr;
    return NextResponse.json({ ok: true, photo_url: publicUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not upload photo" }, { status: 500 });
  }
}
