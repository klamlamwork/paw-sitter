import { NextResponse } from "next/server";
import { publishedKolForSlug } from "@/lib/kolPublic";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get("slug") || "";
    const posts = await publishedKolForSlug(slug);
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load published KOL posts." }, { status: 500 });
  }
}
