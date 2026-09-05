"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;
const VIDEO_SECONDS = 15 * 60;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

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
  const coverRef = useRef(null);
  const productRef = useRef(null);
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [contentType, setContentType] = useState("review");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [takeaways, setTakeaways] = useState([""]);
  const [media, setMedia] = useState([]);
  const [postId, setPostId] = useState("");
  const [status, setStatus] = useState("draft");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [uploadFor, setUploadFor] = useState(null);

  useEffect(() => {
    fetch("/api/shop/kol/catalog?brands=1").then((res) => res.json()).then((data) => setBrands(data.brands || [])).catch(() => {});
    fetch("/api/shop/kol/community-draft").then((res) => res.json()).then((data) => {
      if (!data.draft) return;
      setPostId(data.draft.id);
      setStatus(data.draft.status || "draft");
      if (data.draft.content_type === "how_to" || data.draft.content_type === "review") setContentType(data.draft.content_type);
      if (data.draft.products?.length) {
        setProducts(data.draft.products.map((row) => ({ ...row, description: row.description || "" })));
        if (data.draft.products[0]?.brand_shop_id) setBrandId(data.draft.products[0].brand_shop_id);
      }
      if (data.draft.media?.length) setMedia(data.draft.media.map((row) => ({ id: row.id, resource_type: row.resource_type, caption: row.caption || "", is_cover: !!row.is_cover, product_id: row.product_id || null, name: row.resource_type })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialSlug || products.length) return;
    fetch(`/api/shop/kol/catalog?slug=${encodeURIComponent(initialSlug)}`).then((res) => res.json()).then((data) => {
      const row = data.products?.[0];
      if (!row) return;
      if (row.brand_shop_id) setBrandId(row.brand_shop_id);
      setProducts([{ id: row.id, name: row.name, slug: row.slug, description: "" }]);
    }).catch(() => {});
  }, [initialSlug, products.length]);

  useEffect(() => {
    if (!brandId || query.trim().length < 2) { setMatches([]); return; }
    const handle = setTimeout(() => {
      fetch(`/api/shop/kol/catalog?brand_id=${encodeURIComponent(brandId)}&q=${encodeURIComponent(query.trim())}`).then((res) => res.json()).then((data) => setMatches(data.products || [])).catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [brandId, query]);

  async function syncDraft(nextProducts = products, nextType = contentType) {
    if (!nextProducts.length) throw new Error("Choose a catalog product first.");
    const draftRes = await fetch("/api/shop/kol/community-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_ids: nextProducts.map((row) => row.id), brand_id: brandId, content_type: nextType }) });
    const draft = await draftRes.json().catch(() => ({}));
    if (!draftRes.ok || !draft.post_id) throw new Error(draft.error || "Could not save the product list.");
    setPostId(draft.post_id);
    setStatus(draft.status || "draft");
    return draft.post_id;
  }

  async function addProduct(row) {
    if (products.some((item) => item.id === row.id) || products.length >= 10) return;
    const next = [...products, { id: row.id, name: row.name, slug: row.slug, description: "" }];
    setError("");
    try {
      await syncDraft(next);
      setProducts(next);
      setQuery("");
      setMatches([]);
    } catch (err) {
      setError(err.message || "Could not add that product.");
    }
  }

  async function removeProduct(id) {
    const next = products.filter((row) => row.id !== id);
    setProducts(next);
    setMedia((list) => list.filter((row) => row.product_id !== id));
    if (next.length) {
      try { await syncDraft(next); } catch (err) { setError(err.message); }
    }
  }

  async function chooseFiles(event, productId) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || busy || status === "pending_admin") return;
    const videos = files.filter((file) => VIDEO_TYPES.has(file.type));
    const images = files.filter((file) => IMAGE_TYPES.has(file.type));
    if (videos.length && productId) { setError("Put the video in the cover section, not on a product."); return; }
    if (videos.length > 1 || (videos.length && images.length)) { setError("Upload one video as the cover, or photos only."); return; }
    if (videos.length && media.some((row) => row.resource_type === "video")) { setError("Only one video can be uploaded."); return; }
    for (const file of images) if (file.size > IMAGE_MAX) { setError(`${file.name} is larger than 10 MB.`); return; }
    for (const file of videos) {
      if (file.size > VIDEO_MAX) { setError(`${file.name} is larger than 100 MB.`); return; }
      if (await videoDuration(file) > VIDEO_SECONDS) { setError(`${file.name} is longer than 15 minutes.`); return; }
    }
    setBusy(true);
    setError("");
    try {
      const draftId = await syncDraft();
      const uploaded = [];
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
        uploaded.push({ id: complete.media?.id || complete.id, resource_type: mediaKind, caption: "", is_cover: mediaKind === "video", product_id: productId || null, name: file.name });
      }
      setMedia((list) => {
        const next = [...list, ...uploaded.filter((row) => row.id)];
        if (uploaded.some((row) => row.resource_type === "video")) return next.map((row) => ({ ...row, is_cover: row.resource_type === "video" && !row.product_id }));
        if (!productId && !next.some((row) => row.is_cover && !row.product_id)) {
          const first = next.find((row) => !row.product_id);
          return next.map((row) => ({ ...row, is_cover: first ? row.id === first.id : false }));
        }
        return next;
      });
      setProgress("Saved privately.");
    } catch (err) {
      setError(err.message || "Could not upload media.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!postId || !media.length || busy || status !== "draft") return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/kol/community-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          brand_id: brandId,
          title,
          body,
          content_type: contentType,
          key_takeaways: takeaways,
          products: products.map((row) => ({ id: row.id, description: row.description })),
          media: media.map((row, index) => ({ id: row.id, caption: row.caption, is_cover: !!row.is_cover, product_id: row.product_id, sort_order: index })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit the community post.");
      setStatus("pending_admin");
      setProgress("Submitted for admin approval. It is not public and points are not awarded until approval.");
    } catch (err) {
      setError(err.message || "Could not submit the community post.");
    } finally {
      setBusy(false);
    }
  }

  const locked = status === "pending_admin" || status === "published";
  const coverItems = media.filter((row) => !row.product_id);
  const hasVideo = coverItems.some((row) => row.resource_type === "video");

  return (
    <div className="mt-6 space-y-5 rounded-2xl border border-[#e8d5c4] bg-white p-5">
      <label className="block text-sm font-semibold text-[#3b2a22]">Brand
        <select className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" value={brandId} onChange={(e) => { setBrandId(e.target.value); setQuery(""); setMatches([]); }} disabled={locked}>
          <option value="">Select a brand</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-[#3b2a22]">Products
        <input className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder={brandId ? "Type to search this brand" : "Select a brand first"} value={query} onChange={(e) => setQuery(e.target.value)} disabled={locked || !brandId} />
      </label>
      {matches.length ? <ul className="max-h-48 overflow-auto rounded-xl border border-[#e8d5c4]">{matches.map((row) => <li key={row.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#fff8f0]" onClick={() => addProduct(row)}>{row.name}</button></li>)}</ul> : null}
      <ul className="space-y-2">{products.map((row) => <li key={row.id} className="flex items-center justify-between rounded-xl bg-[#fff8f0] px-3 py-2 text-sm"><span>{row.name}</span>{locked ? null : <button type="button" className="text-xs font-semibold text-red-700" onClick={() => removeProduct(row.id)}>Remove</button>}</li>)}</ul>

      <label className="block text-sm font-semibold text-[#3b2a22]">Post type
        <select className="mt-1 w-full border border-[#e8d5c4] px-3 py-2 text-sm" value={contentType} onChange={(e) => setContentType(e.target.value)} disabled={locked}>
          <option value="how_to">How-to</option>
          <option value="review">In-depth Product Review</option>
        </select>
      </label>
      <input className="w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
      <textarea className="min-h-[90px] w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Optional intro" value={body} onChange={(e) => setBody(e.target.value)} disabled={locked} />

      <div className="rounded-xl border border-dashed border-[#e8d5c4] bg-[#fff8f0] p-4">
        <p className="text-sm font-semibold text-[#3b2a22]">Cover video or photos</p>
        <p className="mt-1 text-xs text-[#7a5c4e]">One video up to 15 minutes becomes the cover. If you add photos only, choose Cover. Captions show under each slide.</p>
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple className="sr-only" onChange={(e) => chooseFiles(e, null)} />
        {locked ? null : <button type="button" disabled={busy || !products.length} onClick={() => coverRef.current?.click()} className="mt-3 rounded-full border border-[#c45c26] bg-white px-4 py-2 text-xs font-semibold text-[#c45c26] disabled:opacity-60">{busy ? progress || "Uploading…" : "Add cover photos or video"}</button>}
        <ul className="mt-3 space-y-2">{coverItems.map((row) => (
          <li key={row.id} className="rounded-lg bg-white p-2 text-xs">
            <p className="font-semibold">{row.resource_type === "video" ? "Video cover" : row.name || "Photo"}{row.is_cover ? " \u00b7 Cover" : ""}</p>
            <input className="mt-1 w-full border border-[#e8d5c4] px-2 py-1" placeholder="Caption" value={row.caption} disabled={locked} onChange={(e) => setMedia((list) => list.map((item) => item.id === row.id ? { ...item, caption: e.target.value } : item))} />
            {!locked && !hasVideo && row.resource_type === "image" ? <button type="button" className="mt-1 font-semibold text-[#c45c26]" onClick={() => setMedia((list) => list.map((item) => ({ ...item, is_cover: !item.product_id && item.id === row.id })))}>Set cover</button> : null}
          </li>
        ))}</ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#3b2a22]">Key takeaways</p>
        <ul className="mt-2 space-y-2">{takeaways.map((row, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <span className="text-[#d4a017]">✓</span>
            <input className="w-full border border-[#e8d5c4] px-3 py-2" placeholder={`Takeaway ${index + 1}`} value={row} disabled={locked} onChange={(e) => setTakeaways((list) => list.map((item, i) => i === index ? e.target.value : item))} />
          </li>
        ))}</ul>
        {locked || takeaways.length >= 12 ? null : <button type="button" className="mt-2 text-xs font-semibold text-[#c45c26]" onClick={() => setTakeaways((list) => [...list, ""])}>Add takeaway</button>}
      </div>

      {products.map((product) => (
        <div key={product.id} className="rounded-xl border border-[#e8d5c4] p-4">
          <p className="text-sm font-semibold text-[#3b2a22]">{product.name}</p>
          <textarea className="mt-2 min-h-[70px] w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Description for this product" value={product.description} disabled={locked} onChange={(e) => setProducts((list) => list.map((row) => row.id === product.id ? { ...row, description: e.target.value } : row))} />
          <input ref={uploadFor === product.id ? productRef : null} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => chooseFiles(e, product.id)} />
          {locked ? null : <button type="button" disabled={busy} onClick={() => { setUploadFor(product.id); setTimeout(() => productRef.current?.click(), 0); }} className="mt-2 rounded-full border border-[#c45c26] px-3 py-1 text-xs font-semibold text-[#c45c26]">Add photos</button>}
          <ul className="mt-2 space-y-2">{media.filter((row) => row.product_id === product.id).map((row) => (
            <li key={row.id}><input className="w-full border border-[#e8d5c4] px-2 py-1 text-xs" placeholder="Caption" value={row.caption} disabled={locked} onChange={(e) => setMedia((list) => list.map((item) => item.id === row.id ? { ...item, caption: e.target.value } : item))} /></li>
          ))}</ul>
        </div>
      ))}

      {postId && media.length && status === "draft" ? <button type="button" disabled={busy} onClick={submit} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit for admin approval"}</button> : null}
      {progress && !busy ? <p className="text-xs text-green-800">{progress}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
