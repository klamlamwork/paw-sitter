"use client";

import { useRef, useState } from "react";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024;

export default function CloudinaryUploader({ kind, productId, label = "Upload photo", onUploaded, onUploadedMany, square = false, multiple = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function uploadOne(file) {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name}: choose an image file.`);
    if (file.size > MAX_BYTES) throw new Error(`${file.name}: image must be 10 MB or smaller.`);

    const signRes = await fetch("/api/media/cloudinary-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, product_id: productId || undefined }),
    });
    const signed = await signRes.json();
    if (!signRes.ok) throw new Error(signed.error || "Could not prepare upload.");

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.api_key);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("public_id", signed.public_id);
    form.append("signature", signed.signature);
    if (signed.overwrite) form.append("overwrite", "true");

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloud_name}/image/upload`, { method: "POST", body: form });
    const result = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(result.error?.message || "Cloudinary upload failed.");
    return {
      public_id: result.public_id,
      version: result.version,
      width: result.width,
      height: result.height,
      preview_url: cloudinaryImageUrl({ publicId: result.public_id, version: result.version, width: square ? 320 : 900, height: square ? 320 : undefined }),
    };
  }

  async function upload(files) {
    setError("");
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy(true);
    try {
      // Sequential signing/upload avoids race conditions in gallery persistence.
      const assets = [];
      for (const file of list) assets.push(await uploadOne(file));
      if (multiple) onUploadedMany?.(assets);
      else onUploaded?.(assets[0]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={(e) => upload(e.target.files)} className="hidden" />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-xs font-semibold text-[#5c4033] disabled:opacity-60">
        {busy ? "Uploading…" : label}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
