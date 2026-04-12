import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { mattressSellingRules } from "../prompt-rules";

type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

type QuestionType =
  | "size"
  | "shopper-mode"
  | "king-path"
  | "firmness"
  | "sleep-position"
  | "cooling"
  | "pressure-relief"
  | "budget"
  | "compare-refine"
  | "generic-refine"
  | null;

type RouteBody = {
  message?: string;
  memorySummary?: string;
  matches?: MatchResult[];
  conversationMode?: string;
  conversationTranscript?: { role: "assistant" | "user"; text: string }[];
  shoppingPhase?: "mattress-discovery" | "post-cart-accessories";
  cartContext?: {
    mattress?: { displayName?: string | null } | null;
  };
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

function buildAccessoryFallbackReply(cartMattressName?: string | null) {
  return {
    reply: emphasizeQuestion(
      `${cartMattressName ? `${cartMattressName} is in the cart.` : "Your mattress is in the cart."} I’ve lined up the most relevant protector, sheets, pillow, base, and adjustable base below. What would you like to add next?`,
    ),
    mode: "product-evaluation",
    questionType: "generic-refine" as QuestionType,
  };
}

function inferQuestionType(text: string, message: string, matches: MatchResult[]): QuestionType {
  const lowerText = text.toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (/what size|which size|size mattress/.test(lowerText)) return "size";
  if (/who are we shopping for|one sleeper or two|just me|two sleepers/.test(lowerText)) return "shopper-mode";
  if (/how would you like to shop this king setup|compromise|split king/.test(lowerText)) return "king-path";
  if (/what firmness|feel best to you|plush|medium|firm/.test(lowerText)) return "firmness";
  if (/sleep position|side sleeper|back sleeper|stomach sleeper/.test(lowerText)) return "sleep-position";
  if (/sleep hot|cooling|temperature|cooler sleep/.test(lowerText)) return "cooling";
  if (/pressure relief|shoulder|hip|back pain|pain|easy movement/.test(lowerText)) return "pressure-relief";
  if (/budget|price range|under \$|value|premium options/.test(lowerText)) return "budget";
  if (/which one sounds better|compare|top options|best fit|narrow on first/.test(lowerText)) return "compare-refine";
  if (lowerMessage.includes("compare") && matches.length > 1) return "compare-refine";
  return "generic-refine";
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
      questionType: "compare-refine" as QuestionType,
    };
  }

  if (lower.includes("compare") && matches.length > 1) {
    return {
      reply: emphasizeQuestion(
        "You can scroll down now to see your current recommendations and compare the top options side by side. What would you like to narrow on first, feel, cooling, or pressure relief?",
      ),
      mode: "comparison",
      questionType: "compare-refine" as QuestionType,
    };
  }

  return {
    reply: emphasizeQuestion(
      "You can scroll down now to see your current recommendations. I can keep refining them based on how you sleep. What matters more for the next step, cooler sleep, pressure relief, or easier movement?",
    ),
    mode: matches.length ? "product-evaluation" : "guided-discovery",
    questionType: "generic-refine" as QuestionType,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RouteBody;
  const message = String(body?.message ?? "").trim();
  const matches = body.matches ?? [];
  const shoppingPhase = body.shoppingPhase ?? "mattress-discovery";
  const cartMattressName = body.cartContext?.mattress?.displayName ?? null;
  const fallback = shoppingPhase === "post-cart-accessories"
    ? buildAccessoryFallbackReply(cartMattressName)
    : buildFallbackReply(message, matches);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: fallback.reply,
      mode: fallback.mode,
      questionType: fallback.questionType,
      liveModel: false,
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const topMatches = matches
      .slice(0, 3)
      .map(
        (match: MatchResult, index: number) =>
          `${index + 1}. ${match.displayName} (${match.brand}, ${match.type ?? "Unknown type"}, ${match.comfort ?? "Unknown feel"})`,
      )
      .join("\n");

    const transcript = (body.conversationTranscript ?? [])
      .slice(-8)
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
      .join("\n");

    const phaseSpecificInstruction = shoppingPhase === "post-cart-accessories"
      ? `The shopper has already added a mattress to cart${cartMattressName ? `: ${cartMattressName}` : ""}. Shift into sleep-setup completion mode. Do not keep helping them choose a mattress. Tell them the accessory recommendations are below and ask one crisp next question about what they want to add first.`
      : `Respond as Shop Pilot with a premium retail-sales-assistant tone. If compare intent is present, invite the shopper to scroll down to compare the top options.`;

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      system:
        `You are Shop Pilot, a premium mattress shopping assistant for a Rooms To Go demo. Be concise, warm, calm, and consultative. Ask only one smart next question. Stay grounded in the provided memory summary, recent transcript, and current candidate matches. Do not mention internal architecture, agents, APIs, or implementation. Keep responses easy to scan, with short sentences. Do not name mattress models or brands in the reply unless the shopper already added one to cart and it is provided in context. Do not mention price or budget unless the shopper explicitly asks about it. Always end with one clear shopper-facing question in double asterisks.

Critical length rules:
- Keep the full reply to 2 short sentences before the final question.
- Maximum total length: 55 words.
- Prefer 20 to 40 words when possible.
- Do not give multi-paragraph explanations.
- Do not repeat or restate the shopper's situation at length.
- If education is useful, give only one brief reason, not a full explanation.
- Sound sharp and helpful, not verbose.

${mattressSellingRules}`,
      messages: [
        {
          role: "user",
          content: `Shopper message: ${message || "(empty)"}\n\nShopping phase: ${shoppingPhase}\n\nMemory summary: ${body.memorySummary ?? "None"}\n\nConversation mode: ${body.conversationMode ?? "guided-discovery"}\n\nRecent transcript:\n${transcript || "No recent transcript"}\n\nCurrent top candidate matches:\n${topMatches || "No matches yet"}\n\n${phaseSpecificInstruction}`,
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
      questionType: inferQuestionType(text || fallback.reply, message, matches),
      liveModel: true,
    });
  } catch {
    return NextResponse.json({
      reply: fallback.reply,
      mode: fallback.mode,
      questionType: fallback.questionType,
      liveModel: false,
    });
  }
}
