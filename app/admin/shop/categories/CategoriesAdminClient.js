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
  const [filterRow, setFilterRow] = useState("1");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  function sortCats(list) {
    return [...list].sort(
      (a, b) =>
        (a.filter_row || 1) - (b.filter_row || 1) ||
        (a.sort_order || 0) - (b.sort_order || 0) ||
        a.name.localeCompare(b.name)
    );
  }

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
        filter_row: Number(filterRow) === 2 ? 2 : 1,
      })
      .select("*")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCats((list) => sortCats([...list, data]));
    setName("");
    setSlug("");
    setDescription("");
    setSortOrder("0");
    setFilterRow("1");
    setOk("Category created.");
    router.refresh();
  }

  async function patchCat(c, fields) {
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_categories").update(fields).eq("id", c.id);
    if (err) {
      setError(err.message);
      return;
    }
    setCats((list) => sortCats(list.map((x) => (x.id === c.id ? { ...x, ...fields } : x))));
    setOk("Saved.");
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Filter line on /shop/
            <select className={inp} value={filterRow} onChange={(e) => setFilterRow(e.target.value)}>
              <option value="1">Line 1 (first row)</option>
              <option value="2">Line 2 (second row)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Sequence within line
            <input
              type="number"
              className={inp}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
        </div>
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
            className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#3b2a22]">{c.name}</p>
                <p className="text-xs text-[#7a5c4e]">/shop/c/{c.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(c)}
                className="text-xs font-semibold text-red-600"
              >
                Delete
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#7a5c4e]">
                Filter line
                <select
                  className={inp + " text-sm"}
                  value={String(c.filter_row || 1)}
                  onChange={(e) =>
                    patchCat(c, { filter_row: Number(e.target.value) === 2 ? 2 : 1 })
                  }
                >
                  <option value="1">Line 1</option>
                  <option value="2">Line 2</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[#7a5c4e]">
                Sequence
                <input
                  type="number"
                  className={inp + " text-sm"}
                  value={c.sort_order ?? 0}
                  onChange={(e) => patchCat(c, { sort_order: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      {!cats.length ? <p className="text-sm text-[#7a5c4e]">No categories yet.</p> : null}
    </div>
  );
}
