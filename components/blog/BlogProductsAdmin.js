"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const empty = { title: "", description: "", image_url: "", url: "", is_active: true };
export default function BlogProductsAdmin({ initialProducts }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts || []);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addProduct(e) {
    e.preventDefault(); setBusy(true); setError("");
    if (!form.title.trim()) { setError("Title required"); setBusy(false); return; }
    const supabase = createClient();
    const { data, error: err } = await supabase.from("blog_products").insert({
      title: form.title.trim(), description: form.description || "", image_url: form.image_url || "", url: form.url || "#", is_active: true,
    }).select("*").single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setProducts((p) => [...p, data]);
    setForm(empty);
    router.refresh();
  }
  async function remove(id) {
    if (!confirm("Delete product?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("blog_products").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setProducts((p) => p.filter((x) => x.id !== id));
    router.refresh();
  }
  return (
    <div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <form onSubmit={addProduct} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product title" className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
        <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
        <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Image URL (optional)" className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" rows={2} className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add product</button>
      </form>
      <ul className="mt-6 space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <div><strong>{p.title}</strong><p className="max-w-xs truncate text-xs text-[#7a5c4e]">{p.url}</p></div>
            <button type="button" onClick={() => remove(p.id)} className="text-xs font-semibold text-red-600">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
