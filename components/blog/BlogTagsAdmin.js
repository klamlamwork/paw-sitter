"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/blog";
export default function BlogTagsAdmin({ initialTags }) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags || []);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addTag(e) {
    e.preventDefault(); setBusy(true); setError("");
    const n = name.trim();
    if (!n) { setBusy(false); return; }
    const supabase = createClient();
    const { data, error: err } = await supabase.from("blog_tags").insert({ name: n, slug: slugify(n) }).select("*").single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setTags((t) => [...t, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    router.refresh();
  }
  async function remove(id) {
    if (!confirm("Delete tag?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("blog_tags").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTags((t) => t.filter((x) => x.id !== id));
    router.refresh();
  }
  return (
    <div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <form onSubmit={addTag} className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag name" className="min-w-[200px] flex-1 rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add tag</button>
      </form>
      <ul className="mt-6 space-y-2">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <span><strong>{t.name}</strong> <span className="text-[#7a5c4e]">/{t.slug}</span></span>
            <button type="button" onClick={() => remove(t.id)} className="text-xs font-semibold text-red-600">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
