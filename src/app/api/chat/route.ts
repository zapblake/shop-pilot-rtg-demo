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

function emphasizeQuestion(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lastQuestionIndex = normalized.lastIndexOf("?");

  if (lastQuestionIndex === -1) return normalized;

  const beforeQuestion = normalized.slice(0, lastQuestionIndex + 1);
  const sentences = beforeQuestion.match(/[^.!?]+[.!?]?/g) ?? [beforeQuestion];
  const questionSentence = sentences[sentences.length - 1]?.trim() ?? beforeQuestion;
  const prefix = normalized.slice(0, normalized.lastIndexOf(questionSentence)).trim();

  return prefix ? `${prefix} **${questionSentence}**` : `**${questionSentence}**`;
}

function buildFallbackReply(message: string, matches: MatchResult[]) {
  const lower = message.toLowerCase();
  const askedBrand = /helix|sealy|tempur|serta|beautyrest|purple|sleepy'?s/i.test(lower);

  if (askedBrand) {
    return {
      reply: emphasizeQuestion(
        "You can scroll down now to see your current recommendations. I can keep refining them based on what you care about most. What matters most to you next, cooling, pressure relief, support, or feel?",
      ),
      mode: matches.length ? "product-evaluation" : "guided-discovery",
    };
  }

  if (lower.includes("compare") && matches.length > 1) {
    return {
      reply: emphasizeQuestion(
        "You can scroll down now to see your current recommendations and compare the top options side by side. What would you like to narrow on first, feel, cooling, or pressure relief?",
      ),
      mode: "comparison",
    };
  }

  return {
    reply: emphasizeQuestion(
      "You can scroll down now to see your current recommendations. I can keep refining them based on how you sleep. What matters more for the next step, cooler sleep, pressure relief, or easier movement?",
    ),
    mode: matches.length ? "product-evaluation" : "guided-discovery",
  };
}

async function getMatches(request: Request, body: RouteBody) {
  const message = String(body?.message ?? "").trim();
  const shouldCallMatchAgent = /side|back|stomach|cool|hot|firm|plush|medium|budget|under|compare|recommend|pressure|support|value|relief|shoulder|hip|price|queen|king|full|twin|helix|sealy|tempur|serta|beautyrest|purple|sleepy'?s/i.test(message);

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
    const topMatches = matches
      .slice(0, 3)
      .map(
        (match: MatchResult, index: number) =>
          `${index + 1}. Candidate ${index + 1} (${match.type ?? "Unknown type"}, ${match.comfort ?? "Unknown feel"})`,
      )
      .join("\n");

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 220,
      system:
        "You are Shop Pilot, a premium mattress shopping assistant for a Rooms To Go demo. Be concise, warm, calm, and consultative. Ask only one smart next question. Stay grounded in the provided memory summary and candidate matches. Do not mention internal architecture, agents, APIs, or implementation. Keep responses easy to scan, with short sentences. Do not name mattress models or brands in the reply. Do not mention price or budget unless the shopper explicitly asks about it. Instead of listing recommendations in chat, tell the shopper they can scroll down now to see their current recommendations. Always end with one clear shopper-facing question in double asterisks.",
      messages: [
        {
          role: "user",
          content: `Shopper message: ${message || "(empty)"}\n\nMemory summary: ${body.memorySummary ?? "None"}\n\nConversation mode: ${body.conversationMode ?? "guided-discovery"}\n\nTop candidate matches:\n${topMatches || "No matches yet"}\n\nRespond as Shop Pilot with a premium retail-sales-assistant tone. If compare intent is present, invite the shopper to scroll down to compare the top options. If the shopper mentions a specific brand, do not say the store does not carry it unless that is certain from the provided candidates. Keep the reply generic and grounded in the current recommendation state.`,
        },
      ],
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
