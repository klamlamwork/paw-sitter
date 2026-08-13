"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function CategoriesAdminClient({ initialCategories }) {
  const router = useRouter();
  const [cats, setCats] = useState(initialCategories || []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function addCat(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const n = name.trim();
    if (!n) {
      setError("Name required");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_categories")
      .insert({
        name: n,
        slug: slugifyShop(slug || n),
        description: description.trim(),
        sort_order: Number(sortOrder) || 0,
      })
      .select("*")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCats((list) =>
      [...list, data].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      )
    );
    setName("");
    setSlug("");
    setDescription("");
    setSortOrder("0");
    setOk("Category created.");
    router.refresh();
  }

  async function remove(c) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_categories").delete().eq("id", c.id);
    if (err) {
      setError(err.message);
      return;
    }
    setCats((list) => list.filter((x) => x.id !== c.id));
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={addCat} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Add category</h2>
        <label className="block text-sm font-medium">
          Name
          <input
            className={inp}
            value={name}
            required
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugifyShop(e.target.value));
            }}
          />
        </label>
        <label className="block text-sm font-medium">
          Slug
          <input
            className={inp + " font-mono"}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea
            className={inp}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Sort order
          <input
            type="number"
            className={inp}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create category"}
        </button>
      </form>

      <ul className="space-y-2">
        {cats.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
          >
            <div>
              <p className="font-semibold text-[#3b2a22]">{c.name}</p>
              <p className="text-xs text-[#7a5c4e]">
                /shop/c/{c.slug} · sort {c.sort_order}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(c)}
              className="text-xs font-semibold text-red-600"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {!cats.length ? <p className="text-sm text-[#7a5c4e]">No categories yet.</p> : null}
    </div>
  );
}
