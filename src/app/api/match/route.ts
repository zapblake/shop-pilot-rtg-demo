import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { mattressSellingRules } from "../prompt-rules";
import { resolveShopperProfile } from "@/lib/match/resolveShopperProfile";
import { scoreCandidates, toMatchResult } from "@/lib/match/scoreCandidates";
import { CoupleSetup, RankedCandidate } from "@/lib/match/types";

const MAX_CANDIDATES_FOR_AI = 12;

type MatchRequestBody = {
  message?: string;
  memorySummary?: string;
  coupleSetup?: CoupleSetup;
  recommendationIntent?: "standard" | "split";
  conversationTranscript?: { role?: string; text?: string }[];
};

async function rerankWithAi({
  candidates,
  shopperMessage,
  memorySummary,
  profileSummary,
}: {
  candidates: RankedCandidate[];
  shopperMessage: string;
  memorySummary: string;
  profileSummary: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || candidates.length === 0) {
    return { usedAi: false, reranked: candidates.slice(0, 3) };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const candidateBlock = candidates
      .slice(0, MAX_CANDIDATES_FOR_AI)
      .map(({ theme, score }, index) => {
        const fields = [
          `id: ${theme.theme}`,
          `displayName: ${theme.displayName}`,
          `brand: ${theme.brand}`,
          `type: ${theme.type || "Unknown"}`,
          `comfort: ${theme.comfort || "Unknown"}`,
          `sizes: ${(theme.availableSizes ?? []).join(", ") || "Unknown"}`,
          `priceFrom: ${theme.priceRange?.min ?? "Unknown"}`,
          `sleepPositions: ${(theme.bestForSleepPositions ?? []).join(", ") || "Unknown"}`,
          `cooling: ${theme.temperatureManagement?.label ?? "Unknown"}`,
          `support: ${theme.supportLevel?.label ?? "Unknown"}`,
          `pressureRelief: ${theme.pressureRelief?.label ?? "Unknown"}`,
          `description: ${theme.description || ""}`,
          `heuristicScore: ${score}`,
        ];

        return `${index + 1}. ${fields.join(" | ")}`;
      })
      .join("\n");

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system:
        `You are a mattress matching engine for a premium retail demo. Your job is to rank candidates, not to chat. Use the resolved shopper profile, shopper message, transcript, and memory summary to choose the best 3 mattresses from the provided candidate list. Prioritize fit, not brand prestige. Respect size preference if present. If the shopper profile signals firm or medium-firm preference, do not let soft or plush options float to the top unless the profile clearly prefers softness. If the shopper profile signals higher body weight or mobility priority, reward stronger support and easier movement and avoid sinky options. If the shopper is asking about split king or Twin XL for two sleepers, treat that as premium purchase intent and avoid cheap entry-level recommendations unless the shopper explicitly asks for budget/value. Never rank adjustable bases, pillows, or non-mattress products above mattresses. Reply with strict JSON only in this shape: {"rankedThemes":[{"theme":string,"score":number,"reason":string}]}. Keep exactly 3 rankedThemes if possible. Scores should be 0-100. Reasons should be short.\n\n${mattressSellingRules}`,
      messages: [
        {
          role: "user",
          content: `Resolved shopper profile: ${profileSummary}\nShopper message: ${shopperMessage || "(empty)"}\nMemory summary: ${memorySummary || "None"}\nCandidates:\n${candidateBlock}`,
        },
      ],
    });

    const text = completion.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    const parsed = JSON.parse(text) as {
      rankedThemes?: { theme?: string; score?: number; reason?: string }[];
    };

    const rankedThemes = parsed.rankedThemes ?? [];
    const reranked = rankedThemes
      .map((entry) => {
        const found = candidates.find(({ theme }) => theme.theme === entry.theme);
        if (!found) return null;
        return {
          theme: found.theme,
          score: typeof entry.score === "number" ? entry.score : Math.max(1, found.score),
          reasons: found.reasons,
        } satisfies RankedCandidate;
      })
      .filter(Boolean) as RankedCandidate[];

    if (!reranked.length) {
      return { usedAi: false, reranked: candidates.slice(0, 3) };
    }

    return { usedAi: true, reranked };
  } catch {
    return { usedAi: false, reranked: candidates.slice(0, 3) };
  }
}

function buildProfileSummary(profile: ReturnType<typeof resolveShopperProfile>) {
  return JSON.stringify({
    size: profile.size,
    sleepPosition: profile.sleepPosition,
    firmnessPreference: profile.firmnessPreference,
    firmnessRigidity: profile.firmnessRigidity,
    weightTier: profile.weightTier,
    mobilityPriority: profile.mobilityPriority,
    pressureReliefPriority: profile.pressureReliefPriority,
    coolingPriority: profile.coolingPriority,
    supportPriority: profile.supportPriority,
    budgetSensitivity: profile.budgetSensitivity,
    preferredBrands: profile.preferredBrands,
    excludedComfortBands: profile.excludedComfortBands,
    premiumIntent: profile.premiumIntent,
    coupleContext: profile.coupleContext,
  });
}

async function buildSplitRecommendation({
  coupleSetup,
  memorySummary,
}: {
  coupleSetup: CoupleSetup;
  memorySummary: string;
}) {
  const sleeper1Profile = resolveShopperProfile({
    shopperMessage: `Twin XL. Sleeper 1 prefers ${coupleSetup.sleeper1Firmness ?? "medium"}. Split king setup.`,
    memorySummary,
    conversationTranscript: [],
    coupleSetup,
  });
  const sleeper2Profile = resolveShopperProfile({
    shopperMessage: `Twin XL. Sleeper 2 prefers ${coupleSetup.sleeper2Firmness ?? "medium"}. Split king setup.`,
    memorySummary,
    conversationTranscript: [],
    coupleSetup,
  });

  const sleeper1Top = scoreCandidates({ ...sleeper1Profile, premiumIntent: true })[0] ?? null;
  const sleeper2Top = scoreCandidates({ ...sleeper2Profile, premiumIntent: true })[0] ?? null;

  return {
    mode: "split" as const,
    split: {
      sleeper1: sleeper1Top ? toMatchResult(sleeper1Top.theme, sleeper1Top.score) : null,
      sleeper2: sleeper2Top ? toMatchResult(sleeper2Top.theme, sleeper2Top.score) : null,
      explanation: "A split king keeps the shared king footprint while giving each sleeper their own Twin XL feel and support profile.",
    },
    trace: {
      agent: "split-mattress-match",
      invoked: true,
      requestedSize: "twin xl",
      usedAi: false,
      reason: "Built separate Twin XL recommendations from resolved sleeper profiles for a split-king flow",
    },
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as MatchRequestBody;
  const shopperInput = String(body?.message ?? "");
  const memorySummary = String(body?.memorySummary ?? "");
  const coupleSetup = (body?.coupleSetup ?? {}) as CoupleSetup;
  const recommendationIntent = body?.recommendationIntent === "split" ? "split" : "standard";
  const conversationTranscript = Array.isArray(body?.conversationTranscript)
    ? body.conversationTranscript
    : [];

  if (
    recommendationIntent === "split" &&
    coupleSetup?.couplePath === "split-king" &&
    coupleSetup?.sleeper1Firmness &&
    coupleSetup?.sleeper2Firmness
  ) {
    return NextResponse.json(await buildSplitRecommendation({ coupleSetup, memorySummary }));
  }

  const profile = resolveShopperProfile({
    shopperMessage: shopperInput,
    memorySummary,
    conversationTranscript,
    coupleSetup,
  });

  const ranked = scoreCandidates(profile);
  const topCandidates = ranked.slice(0, MAX_CANDIDATES_FOR_AI);
  const { usedAi, reranked } = await rerankWithAi({
    candidates: topCandidates,
    shopperMessage: `${shopperInput}\nRecent conversation: ${conversationTranscript.slice(-12).map((entry) => `${String(entry.role ?? "user")}: ${String(entry.text ?? "")}`).join(" ")}`,
    memorySummary,
    profileSummary: buildProfileSummary(profile),
  });

  const finalRanked = (usedAi ? reranked : topCandidates)
    .slice(0, 3)
    .map(({ theme, score }) => toMatchResult(theme, score));

  return NextResponse.json({
    mode: "standard",
    matches: finalRanked,
    trace: {
      agent: usedAi ? "ai-reranker" : "resolved-profile-matcher",
      invoked: true,
      requestedSize: profile.size,
      requestedBrand: profile.preferredBrands[0] ?? null,
      usedAi,
      candidateCount: topCandidates.length,
      profile,
      reason: usedAi
        ? "Resolved shopper profile, deterministic candidate scoring, then optional AI reranking"
        : "Resolved shopper profile with deterministic scoring",
    },
  });
}
