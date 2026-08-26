"use client";

import { useRef, useState } from "react";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024;

export default function CloudinaryUploader({ kind, productId, label = "Upload photo", onUploaded, square = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
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
      onUploaded?.({
        public_id: result.public_id,
        version: result.version,
        width: result.width,
        height: result.height,
        preview_url: cloudinaryImageUrl({ publicId: result.public_id, version: result.version, width: square ? 320 : 900, height: square ? 320 : undefined }),
      });
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} className="hidden" />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-xs font-semibold text-[#5c4033] disabled:opacity-60">
        {busy ? "Uploading…" : label}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
