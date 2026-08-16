"use client";

import { useState } from "react";

export default function ReviewForm({
  token,
  role,
  sitterName,
  pets = [],
  existingSitterReview,
  existingPetReviews = [],
}) {
  const already = Object.fromEntries(existingPetReviews.map((r) => [r.pet_id, r]));
  const [rating, setRating] = useState(existingSitterReview?.rating || 0);
  const [body, setBody] = useState(existingSitterReview?.body || "");
  const [petBodies, setPetBodies] = useState(() => {
    const next = {};
    for (const pet of pets) next[pet.id] = already[pet.id]?.body || "";
    return next;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(role === "customer" ? !!existingSitterReview : existingPetReviews.length === pets.length && pets.length > 0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        role === "customer"
          ? { token, rating, body }
          : {
              token,
              pets: pets
                .filter((pet) => !already[pet.id])
                .map((pet) => ({ pet_id: pet.id, body: petBodies[pet.id] || "" })),
            };
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit review");
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not submit review");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-6 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4 text-sm text-[#3b2a22]">
        Thank you. Your review is waiting for admin approval before it is published.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-[#e8d5c4] bg-white p-5">
      {role === "customer" ? (
        <>
          <p className="font-semibold text-[#3b2a22]">{sitterName}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={"h-10 w-10 text-xl " + (n <= rating ? "text-[#c77e10]" : "text-[#efd09a]")}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="min-h-[120px] w-full border border-[#e8d5c4] px-3 py-2 text-sm"
            placeholder="What went well? Anything the next family should know?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </>
      ) : pets.length === 0 ? (
        <p className="text-sm text-[#7a5c4e]">No pets were attached to this booking.</p>
      ) : (
        pets.map((pet) => (
          <label key={pet.id} className="block">
            <span className="font-semibold text-[#3b2a22]">{pet.name}</span>
            <span className="ml-2 text-xs text-[#7a5c4e]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</span>
            {already[pet.id] ? (
              <p className="mt-1 text-sm text-[#5c4033]">{already[pet.id].body}</p>
            ) : (
              <textarea
                className="mt-1 min-h-[90px] w-full border border-[#e8d5c4] px-3 py-2 text-sm"
                placeholder={`Write a public note about ${pet.name}`}
                value={petBodies[pet.id] || ""}
                onChange={(e) => setPetBodies((prev) => ({ ...prev, [pet.id]: e.target.value }))}
              />
            )}
          </label>
        ))
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Sending…" : "Submit for admin review"}
      </button>
    </form>
  );
}
