"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function statusLabel(status) {
  return ({ draft: "Private draft", pending_admin: "Pending admin approval", needs_changes: "Changes requested", published: "Published" })[status] || status || "";
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number(video.duration) || 0); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
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

export default function VerifiedKolMediaUpload({ itemId, title, body, rating }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [postId, setPostId] = useState("");
  const [status, setStatus] = useState("");
  const [mediaCount, setMediaCount] = useState(0);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/shop/kol/verified-draft?order_item_id=${encodeURIComponent(itemId)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!active || !res.ok || !data.draft) return;
        setPostId(data.draft.id);
        setStatus(data.draft.status || "");
        setMediaCount(Number(data.draft.media_count || 0));
        setAdminNote(data.draft.admin_note || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, [itemId]);

  async function ensureDraft() {
    if (postId) return postId;
    const draftRes = await fetch("/api/shop/kol/verified-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_item_id: itemId }) });
    const draft = await draftRes.json().catch(() => ({}));
    if (!draftRes.ok || !draft.post_id) throw new Error(draft.error || "Could not create a private media draft.");
    setPostId(draft.post_id);
    setStatus(draft.status || "draft");
    setMediaCount(Number(draft.media_count || 0));
    setAdminNote(draft.admin_note || "");
    return draft.post_id;
  }

  async function reopen() {
    if (!postId || busy || status !== "needs_changes") return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/kol/reopen-requested-changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, order_item_id: itemId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reopen the draft.");
      setStatus("draft");
      setMediaCount((count) => count + Number(data.copied_media || 0));
      setProgress("Draft reopened. Update the review and submit it again for admin approval.");
    } catch (err) {
      setError(err.message || "Could not reopen the draft.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFiles(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || busy || status === "pending_admin" || status === "published" || status === "needs_changes") return;
    setError("");
    const videos = files.filter((file) => VIDEO_TYPES.has(file.type));
    const images = files.filter((file) => IMAGE_TYPES.has(file.type));
    if (videos.length > 1 || (videos.length && images.length > 9) || (!videos.length && images.length > 10) || videos.length + images.length !== files.length) { setError("Choose JPEG, PNG, or WebP images (up to 10), or one MP4/WebM video with up to 9 images."); return; }
    for (const file of images) if (file.size > IMAGE_MAX) { setError(`${file.name} is larger than 10 MB.`); return; }
    for (const file of videos) {
      if (file.size > VIDEO_MAX) { setError(`${file.name} is larger than 100 MB.`); return; }
      if (await videoDuration(file) > 90) { setError(`${file.name} is longer than 90 seconds.`); return; }
    }
    setBusy(true);
    try {
      const draftId = await ensureDraft();
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const mediaKind = VIDEO_TYPES.has(file.type) ? "video" : "image";
        setProgress(`Uploading ${index + 1} of ${files.length}…`);
        const signRes = await fetch("/api/media/kol-sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: draftId, media_kind: mediaKind }) });
        const signed = await signRes.json().catch(() => ({}));
        if (!signRes.ok) throw new Error(signed.error || "Could not authorize this upload.");
        const cloud = await uploadDirect(file, signed);
        const completeRes = await fetch("/api/shop/kol/media-complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: signed.session_id, public_id: cloud.public_id, version: cloud.version, resource_type: cloud.resource_type, bytes: cloud.bytes, width: cloud.width, height: cloud.height, duration_seconds: cloud.duration }) });
        const complete = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) throw new Error(complete.error || "Could not save uploaded media.");
      }
      setMediaCount((count) => count + files.length);
      setStatus("draft");
      setProgress("Saved privately. Submit it for admin review when your review text is ready.");
    } catch (err) {
      setError(err.message || "Could not upload media.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function submitMediaReview() {
    if (!postId || !mediaCount || busy || status !== "draft") return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/kol/verified-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, order_item_id: itemId, title, body, rating }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit the media review.");
      setStatus("pending_admin");
      setProgress("Submitted for admin approval. It is not public and points are not awarded until approval.");
    } catch (err) {
      setError(err.message || "Could not submit the media review.");
    } finally {
      setBusy(false);
    }
  }

  const locked = status === "pending_admin" || status === "published";
  return <div className="rounded-xl border border-dashed border-[#e8d5c4] bg-[#fff8f0] p-4">
    <p className="text-sm font-semibold text-[#3b2a22]">Optional photos or video</p>
    <p className="mt-1 text-xs text-[#7a5c4e]">Media reviews are private until admin approval. Photos may earn 500 Paw Points; a video may earn 2,000.</p>
    {status ? <p className="mt-2 text-xs font-semibold text-[#5c4033]">KOL media status: {statusLabel(status)}{mediaCount ? ` · ${mediaCount} private file${mediaCount === 1 ? "" : "s"}` : ""}</p> : null}
    {status === "needs_changes" && adminNote ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-800">Admin requested: {adminNote}</p> : null}
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple className="sr-only" onChange={chooseFiles} />
    {status === "needs_changes" ? <button type="button" disabled={busy} onClick={reopen} className="mt-3 rounded-full border border-[#c45c26] bg-white px-4 py-2 text-xs font-semibold text-[#c45c26] disabled:opacity-60">{busy ? "Reopening…" : "Edit and resubmit"}</button> : null}
    {!locked && status !== "needs_changes" ? <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-3 rounded-full border border-[#c45c26] bg-white px-4 py-2 text-xs font-semibold text-[#c45c26] disabled:opacity-60">{busy ? progress || "Uploading…" : "Add photos or video"}</button> : null}
    {postId && mediaCount > 0 && status === "draft" ? <button type="button" disabled={busy} onClick={submitMediaReview} className="ml-2 mt-3 rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit media review for approval"}</button> : null}
    {progress && !busy ? <p className="mt-2 text-xs text-green-800">{progress}</p> : null}
    {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
  </div>;
}
