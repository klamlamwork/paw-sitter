"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function CommunityKolForm({ initialSlug = "" }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [product, setProduct] = useState(null);
  const [contentType, setContentType] = useState("review");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState("");
  const [postId, setPostId] = useState("");
  const [status, setStatus] = useState("");
  const [mediaCount, setMediaCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/shop/kol/community-draft").then((res) => res.json().then((data) => ({ res, data }))).then(({ res, data }) => {
      if (!active || !res.ok || !data.draft) return;
      setPostId(data.draft.id);
      setStatus(data.draft.status || "");
      setMediaCount(Number(data.draft.media_count || 0));
      if (data.draft.product) setProduct(data.draft.product);
      if (data.draft.content_type) setContentType(data.draft.content_type);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!initialSlug || product) return;
    fetch(`/api/shop/kol/catalog?slug=${encodeURIComponent(initialSlug)}`).then((res) => res.json()).then((data) => {
      if (data.products?.[0]) setProduct(data.products[0]);
    }).catch(() => {});
  }, [initialSlug, product]);

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return; }
    const handle = setTimeout(() => {
      fetch(`/api/shop/kol/catalog?q=${encodeURIComponent(query.trim())}`).then((res) => res.json()).then((data) => setMatches(data.products || [])).catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function ensureDraft(nextProduct = product) {
    if (!nextProduct?.id) throw new Error("Choose a catalog product first.");
    if (postId && product?.id === nextProduct.id) return postId;
    const draftRes = await fetch("/api/shop/kol/community-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: nextProduct.id, content_type: contentType }) });
    const draft = await draftRes.json().catch(() => ({}));
    if (!draftRes.ok || !draft.post_id) throw new Error(draft.error || "Could not create a private community draft.");
    setPostId(draft.post_id);
    setStatus(draft.status || "draft");
    setMediaCount(Number(draft.media_count || 0));
    setProduct(draft.product || nextProduct);
    return draft.post_id;
  }

  async function chooseProduct(next) {
    setError("");
    try {
      await ensureDraft(next);
      setQuery("");
      setMatches([]);
    } catch (err) {
      setError(err.message || "Could not select that product.");
    }
  }

  async function chooseFiles(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || busy || status === "pending_admin" || status === "published") return;
    setError("");
    const videos = files.filter((file) => VIDEO_TYPES.has(file.type));
    const images = files.filter((file) => IMAGE_TYPES.has(file.type));
    if (videos.length > 1 || (videos.length && images.length > 9) || (!videos.length && images.length > 10) || videos.length + images.length !== files.length) {
      setError("Choose JPEG, PNG, or WebP images (up to 10), or one MP4/WebM video with up to 9 images.");
      return;
    }
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
      setProgress("Saved privately. Submit it for admin review when your text is ready.");
    } catch (err) {
      setError(err.message || "Could not upload media.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!postId || !mediaCount || busy || status !== "draft") return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/kol/community-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, title, body, rating: rating === "" ? null : Number(rating), content_type: contentType }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit the community post.");
      setStatus("pending_admin");
      setProgress("Submitted for admin approval. It is not public and points are not awarded until approval.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not submit the community post.");
    } finally {
      setBusy(false);
    }
  }

  const locked = status === "pending_admin" || status === "published";
  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-[#e8d5c4] bg-white p-5">
      <label className="block text-sm font-semibold text-[#3b2a22]">Product
        <input className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Search catalog products" value={query} onChange={(e) => setQuery(e.target.value)} disabled={locked} />
      </label>
      {product ? <p className="text-sm text-[#5c4033]">Selected: {product.name}</p> : null}
      {matches.length ? <ul className="max-h-48 overflow-auto rounded-xl border border-[#e8d5c4]">{matches.map((row) => <li key={row.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#fff8f0]" onClick={() => chooseProduct(row)}>{row.name}</button></li>)}</ul> : null}
      <label className="block text-sm font-semibold text-[#3b2a22]">Post type
        <select className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" value={contentType} onChange={(e) => setContentType(e.target.value)} disabled={locked}>
          <option value="review">Community review</option>
          <option value="how_to">How-to</option>
          <option value="education">Education</option>
        </select>
      </label>
      <input className="w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
      <textarea className="min-h-[120px] w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="What should people know?" value={body} onChange={(e) => setBody(e.target.value)} disabled={locked} />
      <label className="block text-sm text-[#5c4033]">Stars optional
        <select className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" value={rating} onChange={(e) => setRating(e.target.value)} disabled={locked}>
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
        </select>
      </label>
      <div className="rounded-xl border border-dashed border-[#e8d5c4] bg-[#fff8f0] p-4">
        <p className="text-sm font-semibold text-[#3b2a22]">Photos or video</p>
        {status ? <p className="mt-2 text-xs font-semibold text-[#5c4033]">Status: {statusLabel(status)}{mediaCount ? ` · ${mediaCount} private file${mediaCount === 1 ? "" : "s"}` : ""}</p> : null}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple className="sr-only" onChange={chooseFiles} />
        {!locked ? <button type="button" disabled={busy || !product} onClick={() => inputRef.current?.click()} className="mt-3 rounded-full border border-[#c45c26] bg-white px-4 py-2 text-xs font-semibold text-[#c45c26] disabled:opacity-60">{busy ? progress || "Uploading…" : "Add photos or video"}</button> : null}
        {postId && mediaCount > 0 && status === "draft" ? <button type="button" disabled={busy} onClick={submit} className="ml-2 mt-3 rounded-full bg-[#c45c26] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit for admin approval"}</button> : null}
      </div>
      {progress && !busy ? <p className="text-xs text-green-800">{progress}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
