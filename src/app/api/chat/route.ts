import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  const currentTheme = body?.currentTheme ?? null;

  const shouldCallMatchAgent = /side|back|stomach|cool|hot|firm|plush|medium|budget|under|compare|recommend/i.test(message);

  let matches = [];
  let matchTrace = null;

  if (shouldCallMatchAgent) {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const matchPayload = await response.json();
    matches = matchPayload.matches ?? [];
    matchTrace = matchPayload.trace ?? null;
  }

  const topMatch = matches[0]?.displayName;

  return NextResponse.json({
    reply: shouldCallMatchAgent
      ? `Got it. I’m keeping this conversational on the surface while the match agent narrows the field${topMatch ? `, with ${topMatch} currently leading the set` : ""}. Next I’d ask one follow-up to tighten the recommendation.`
      : `Understood. I can keep guiding from here${currentTheme ? ` while staying anchored to ${currentTheme}` : ""}, and I’ll only pull in the deeper match workflow when your preferences are specific enough to benefit from it.`,
    mode: shouldCallMatchAgent ? "product-evaluation" : "guided-discovery",
    trace: {
      agent: "conversational",
      calledMatchAgent: shouldCallMatchAgent,
    },
    matches,
    matchTrace,
  });
}
