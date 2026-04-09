import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

type RouteBody = {
  message?: string;
  memorySummary?: string;
  matches?: MatchResult[];
  conversationMode?: string;
};

function buildFallbackReply(message: string, matches: MatchResult[]) {
  const lower = message.toLowerCase();
  const [first, second] = matches;

  if (lower.includes("compare") && first && second) {
    return {
      reply: `Absolutely. I’d compare ${first.displayName} and ${second.displayName} this way: ${first.displayName} looks like the stronger overall fit right now, while ${second.displayName} gives you a solid alternative if you want a slightly different feel or value balance. Want me to narrow that to feel, cooling, or price first?`,
      mode: "comparison",
    };
  }

  return {
    reply: first
      ? `That gives me a clearer read. ${first.displayName} is leading the set right now. What matters more for the next step, cooler sleep, pressure relief, easier movement, or price?`
      : "That gives me a clearer read. What matters more for the next step, cooler sleep, pressure relief, easier movement, or price?",
    mode: matches.length ? "product-evaluation" : "guided-discovery",
  };
}

async function getMatches(request: Request, body: RouteBody) {
  const message = String(body?.message ?? "").trim();
  const shouldCallMatchAgent = /side|back|stomach|cool|hot|firm|plush|medium|budget|under|compare|recommend|pressure|support|value|relief|shoulder|hip|price/i.test(message);

  if (!shouldCallMatchAgent) return [] as MatchResult[];

  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const matchPayload = await response.json();
  return matchPayload.matches ?? [];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RouteBody;
  const message = String(body?.message ?? "").trim();
  const matches = await getMatches(request, body);
  const fallback = buildFallbackReply(message, matches);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: fallback.reply,
      mode: fallback.mode,
      matches,
      liveModel: false,
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const topMatches = matches.slice(0, 3).map((match, index) => `${index + 1}. ${match.displayName} (${match.brand}, ${match.type ?? "Unknown type"}, ${match.comfort ?? "Unknown feel"}, ${match.priceFrom ? `$${match.priceFrom}` : "price TBD"})`).join("\n");

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 220,
      system: `You are Shop Pilot, a premium mattress shopping assistant for a Rooms To Go demo. Be concise, warm, calm, and consultative. Ask only one smart next question. Stay grounded in the provided memory summary and candidate matches. Do not mention internal architecture, agents, APIs, or implementation.`,
      messages: [
        {
          role: "user",
          content: `Shopper message: ${message || "(empty)"}\n\nMemory summary: ${body.memorySummary ?? "None"}\n\nConversation mode: ${body.conversationMode ?? "guided-discovery"}\n\nTop candidate matches:\n${topMatches || "No matches yet"}\n\nRespond as Shop Pilot with a premium retail-sales-assistant tone. If compare intent is present, compare the top options naturally. End with one useful next question unless the shopper explicitly asked for comparison only.`
        }
      ]
    });

    const text = completion.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: text || fallback.reply,
      mode: /compare/i.test(message) && matches.length > 1 ? "comparison" : fallback.mode,
      matches,
      liveModel: true,
    });
  } catch {
    return NextResponse.json({
      reply: fallback.reply,
      mode: fallback.mode,
      matches,
      liveModel: false,
    });
  }
}
