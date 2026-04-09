import { NextResponse } from "next/server";

type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

function buildReply(message: string, matches: MatchResult[]) {
  const lower = message.toLowerCase();
  const [first, second] = matches;

  if (lower.includes("compare") && first && second) {
    return {
      reply: `Absolutely. I’d compare ${first.displayName} and ${second.displayName} this way: ${first.displayName} looks like the stronger overall fit right now, while ${second.displayName} gives you a solid alternative if you want a slightly different feel or value balance. Want me to narrow that to feel, cooling, or price first?`,
      mode: "comparison",
    };
  }

  if (/(side|back|stomach)/i.test(message) && /(hot|cool)/i.test(message)) {
    return {
      reply: first
        ? `${first.displayName} is a strong early fit. Since temperature and sleep position matter most so far, would you rather optimize for deeper pressure relief or a slightly more supportive, lifted feel?`
        : "That helps a lot. Since temperature and sleep position matter most so far, would you rather optimize for deeper pressure relief or a slightly more supportive, lifted feel?",
      mode: "product-evaluation",
    };
  }

  if (/(budget|under|\$|value)/i.test(message)) {
    return {
      reply: first
        ? `Understood. I’m keeping the set anchored to options that respect your budget, and ${first.displayName} is one of the better fits so far. Do you want the best value play, or something that feels a bit more premium while staying in range?`
        : "Understood. I’m keeping the set anchored to options that respect your budget. Do you want the best value play, or something that feels a bit more premium while staying in range?",
      mode: "product-evaluation",
    };
  }

  if (/(firm|medium|plush|soft)/i.test(message)) {
    return {
      reply: first
        ? `That narrows things nicely. ${first.displayName} stays in a strong position with that feel preference in mind. One more thing, are you after easier movement, more contouring pressure relief, or a balance of both?`
        : "That narrows things nicely. One more thing, are you after easier movement, more contouring pressure relief, or a balance of both?",
      mode: "product-evaluation",
    };
  }

  if (/(pressure|relief|shoulder|hip)/i.test(message)) {
    return {
      reply: first
        ? `${first.displayName} rises a bit on pressure relief. To tighten this up, do you want a bed that hugs a little more, or one that still relieves pressure but feels easier to move around on?`
        : "That gives me a useful direction. To tighten this up, do you want a bed that hugs a little more, or one that still relieves pressure but feels easier to move around on?",
      mode: "product-evaluation",
    };
  }

  return {
    reply: first
      ? `That gives me a clearer read. ${first.displayName} is leading the set right now. What matters more for the next step, cooler sleep, pressure relief, easier movement, or price?`
      : "That gives me a clearer read. What matters more for the next step, cooler sleep, pressure relief, easier movement, or price?",
    mode: matches.length ? "product-evaluation" : "guided-discovery",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();

  const shouldCallMatchAgent = /side|back|stomach|cool|hot|firm|plush|medium|budget|under|compare|recommend|pressure|support|value|relief|shoulder|hip|price/i.test(message);

  let matches: MatchResult[] = [];

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

  const next = buildReply(message, matches);

  return NextResponse.json({
    reply: next.reply,
    mode: next.mode,
    matches,
  });
}
