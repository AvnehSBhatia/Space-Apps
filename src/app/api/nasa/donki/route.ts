// Live DONKI proxy: GET /api/nasa/donki?type=GST&start=2026-10-01&end=2026-11-15
// Keeps the NASA API key on the server and lets the CDN cache each answer for an hour.

import { NextResponse, type NextRequest } from "next/server";
import { DONKI_TYPES, fetchDonki, isDonkiType } from "@/lib/nasa/donki";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = (params.get("type") ?? "GST").toUpperCase();
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";

  if (!isDonkiType(type)) {
    return NextResponse.json({ error: `type must be one of ${DONKI_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!DATE.test(start) || !DATE.test(end)) {
    return NextResponse.json({ error: "start and end must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const events = await fetchDonki(type, start, end);
    return NextResponse.json(
      { source: "NASA DONKI", type, start, end, fetchedAt: new Date().toISOString(), events },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
