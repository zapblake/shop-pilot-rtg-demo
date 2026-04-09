import { NextResponse } from "next/server";

function buildReply(message: string, topMatch?: string) {
  const lower = message.toLowerCase();

  if (/(side|back|stomach)/i.test(message) && /(hot|cool)/i.test(message)) {
    return topMatch
      ? `${topMatch} is a strong early fit. Since temperature and sleep position matter most so far, my next question is whether you want more contouring pressure relief or a slightly more lifted feel.`
      : "That helps a lot. Since temperature and sleep position matter most so far, my next question is whether you want more contouring pressure relief or a slightly more lifted feel.";
  }

  if (/(budget|under|\$)/i.test(message)) {
    return topMatch
      ? `Understood. I’m keeping the set anchored to options that respect your budget, and ${topMatch} is one of the better fits so far. Do you want the best value play, or something that feels a bit more premium within range?`
      : "Understood. I’m keeping the set anchored to options that respect your budget. Do you want the best value play, or something that feels a bit more premium within range?";
  }

  if (/(firm|medium|plush|soft)/i.test(message)) {
    return topMatch
      ? `That narrows things nicely. ${topMatch} stays in a strong position with that feel preference in mind. One more thing, are you shopping mainly for pressure relief, easier movement, or both?`
      : "That narrows things nicely. One more thing, are you shopping mainly for pressure relief, easier movement, or both?";
  }

  if (lower.includes("compare")) {
    return topMatch
      ? `Absolutely. I can line up the leading options side by side, starting with ${topMatch}. Tell me if you want to compare feel, cooling, or overall value first.`
      : "Absolutely. I can line up the leading options side by side. Tell me if you want to compare feel, cooling, or overall value first.";
  }

  return topMatch
    ? `That gives me a clearer read. ${topMatch} is leading the set right now. What matters more for the next step, cooler sleep, pressure relief, or staying firmly inside budget?`
    : "That gives me a clearer read. What matters more for the next step, cooler sleep, pressure relief, or staying firmly inside budget?";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();

  const shouldCallMatchAgent = /side|back|stomach|cool|hot|firm|plush|medium|budget|under|compare|recommend|pressure|support|value/i.test(message);

  let matches = [];

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
  }

  const topMatch = matches[0]?.displayName;

  return NextResponse.json({
    reply: buildReply(message, topMatch),
    mode: shouldCallMatchAgent ? "product-evaluation" : "guided-discovery",
    matches,
  });
}
