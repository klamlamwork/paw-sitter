"use client";

import { useRef, useState } from "react";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function videoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number(video.duration) || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

async function uploadDirect(file, signed) {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.api_key);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);
  form.append("public_id", signed.public_id);
  const res = await fetch(signed.upload_url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || "Cloudinary upload failed.");
  return data;
}

export default function VerifiedKolMediaUpload({ itemId }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState([]);

  async function chooseFiles(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || busy) return;
    setError("");

    const videos = files.filter((file) => VIDEO_TYPES.has(file.type));
    const images = files.filter((file) => IMAGE_TYPES.has(file.type));
    if (videos.length > 1 || (videos.length && images.length > 9) || (!videos.length && images.length > 10) || videos.length + images.length !== files.length) {
      setError("Choose JPEG, PNG, or WebP images (up to 10), or one MP4/WebM video with up to 9 images.");
      return;
    }
    for (const file of images) {
      if (file.size > IMAGE_MAX) {
        setError(`${file.name} is larger than 10 MB.`);
        return;
      }
    }
    for (const file of videos) {
      if (file.size > VIDEO_MAX) {
        setError(`${file.name} is larger than 100 MB.`);
        return;
      }
      const seconds = await videoDuration(file);
      if (seconds > 90) {
        setError(`${file.name} is longer than 90 seconds.`);
        return;
      }
    }

    setBusy(true);
    try {
      setProgress("Preparing private draft…");
      const draftRes = await fetch("/api/shop/kol/verified-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_item_id: itemId }),
      });
      const draft = await draftRes.json().catch(() => ({}));
      if (!draftRes.ok || !draft.post_id) throw new Error(draft.error || "Could not create a private media draft.");

      const uploaded = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const mediaKind = VIDEO_TYPES.has(file.type) ? "video" : "image";
        setProgress(`Uploading ${index + 1} of ${files.length}…`);
        const signRes = await fetch("/api/media/kol-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: draft.post_id, media_kind: mediaKind }),
        });
        const signed = await signRes.json().catch(() => ({}));
        if (!signRes.ok) throw new Error(signed.error || "Could not authorize this upload.");
        const cloud = await uploadDirect(file, signed);
        const completeRes = await fetch("/api/shop/kol/media-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: signed.session_id,
            public_id: cloud.public_id,
            version: cloud.version,
            resource_type: cloud.resource_type,
            bytes: cloud.bytes,
            width: cloud.width,
            height: cloud.height,
            duration_seconds: cloud.duration,
          }),
        });
        const complete = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) throw new Error(complete.error || "Could not save uploaded media.");
        uploaded.push({ name: file.name, kind: mediaKind });
      }
      setDone((previous) => [...previous, ...uploaded]);
      setProgress("Saved privately. Submit it for admin review in the next KOL step.");
    } catch (err) {
      setError(err.message || "Could not upload media.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[#e8d5c4] bg-[#fff8f0] p-4">
      <p className="text-sm font-semibold text-[#3b2a22]">Optional photos or video</p>
      <p className="mt-1 text-xs text-[#7a5c4e]">Media reviews are private until admin approval. Photos may earn 500 Paw Points; a video may earn 2,000. Points are not awarded yet.</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple className="sr-only" onChange={chooseFiles} />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-3 rounded-full border border-[#c45c26] bg-white px-4 py-2 text-xs font-semibold text-[#c45c26] disabled:opacity-60">
        {busy ? progress || "Uploading…" : "Add photos or video"}
      </button>
      {progress && !busy ? <p className="mt-2 text-xs text-green-800">{progress}</p> : null}
      {done.length ? <p className="mt-2 text-xs text-green-800">Private upload: {done.map((file) => file.name).join(", ")}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
