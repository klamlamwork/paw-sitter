"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cloudinaryImageUrl } from "@/lib/cloudinary";
import CloudinaryUploader from "./CloudinaryUploader";

export default function AccountAvatarUpload({ initialPublicId = "", initialVersion = null }) {
  const [asset, setAsset] = useState({ public_id: initialPublicId, version: initialVersion });
  const [error, setError] = useState("");
  const preview = cloudinaryImageUrl({ publicId: asset.public_id, version: asset.version, width: 160, height: 160 });

  async function save(next) {
    setAsset(next);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in first."); return; }
    const { error: updateError } = await supabase.from("profiles").update({ avatar_public_id: next.public_id, avatar_version: next.version }).eq("id", user.id);
    if (updateError) setError(updateError.message);
  }

  return (
    <section className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Profile photo</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-white ring-1 ring-[#e8d5c4]">
          {preview ? <img src={preview} alt="Profile" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-bold text-[#c4a484]">?</div>}
        </div>
        <CloudinaryUploader kind="profile" label={preview ? "Replace photo" : "Upload photo"} square onUploaded={save} />
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
