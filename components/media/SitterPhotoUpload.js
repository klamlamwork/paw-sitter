"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cloudinaryImageUrl } from "@/lib/cloudinary";
import CloudinaryUploader from "./CloudinaryUploader";

export default function SitterPhotoUpload({ sitter }) {
  const [asset, setAsset] = useState({ public_id: sitter?.profile_pic_public_id || "", version: sitter?.profile_pic_version || null });
  const [error, setError] = useState("");
  const preview = cloudinaryImageUrl({ publicId: asset.public_id, version: asset.version, width: 240, height: 240 });

  async function save(next) {
    setAsset(next);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("sitters").update({ profile_pic_public_id: next.public_id, profile_pic_version: next.version }).eq("id", sitter.id);
    if (updateError) setError(updateError.message);
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Sitter profile photo</h2>
      <p className="mt-1 text-sm text-[#7a5c4e]">This square image will be used on sitter cards and your public sitter profile.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-white ring-1 ring-[#e8d5c4]">
          {preview ? <img src={preview} alt="Sitter profile" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl font-bold text-[#c4a484]">?</div>}
        </div>
        <CloudinaryUploader kind="sitter" label={preview ? "Replace sitter photo" : "Upload sitter photo"} square onUploaded={save} />
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
