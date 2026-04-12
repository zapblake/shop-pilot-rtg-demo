import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import mattressThemes from "@/data/mattressThemes.normalized.json";
import { mattressSellingRules } from "../prompt-rules";

const brandTerms = ["helix", "sealy", "tempur", "serta", "beautyrest", "purple", "sleepy's", "sleepys"];
const MAX_CANDIDATES_FOR_AI = 12;

type ThemeRecord = (typeof mattressThemes)[number];

type RankedCandidate = {
  theme: ThemeRecord;
  score: number;
};

type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

type CoupleSetup = {
  shopperMode?: "single" | "two-similar" | "two-different" | null;
  couplePath?: "compromise" | "split-king" | null;
  sleeper1Firmness?: string | null;
  sleeper2Firmness?: string | null;
};

function isMattressTheme(theme: ThemeRecord) {
  const searchable = [theme.displayName, theme.brand, theme.type, theme.description, theme.themeSummary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (searchable.includes("pillow")) return false;
  if (searchable.includes("ergo") || searchable.includes("adjustable base") || searchable.includes("base")) return false;
  return true;
}

function scorePremiumIntent(theme: ThemeRecord) {
  let score = 0;
  const price = theme.priceRange?.min ?? 0;
  const searchable = [theme.displayName, theme.brand, theme.type, theme.description, theme.themeSummary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (price >= 2500) score += 2;
  if (price >= 3500) score += 1;
  if (theme.supportLevel?.score) score += theme.supportLevel.score >= 4 ? 2 : 1;
  if (theme.pressureRelief?.score) score += theme.pressureRelief.score >= 4 ? 2 : 1;
  if (theme.temperatureManagement?.score) score += theme.temperatureManagement.score >= 4 ? 1 : 0;
  if (searchable.includes("tempur")) score += 1;
  if (searchable.includes("hybrid") || searchable.includes("breeze") || searchable.includes("luxe") || searchable.includes("proadapt")) score += 1;

  return score;
}

const sizeAliases: Record<string, string[]> = {
  twin: ["Twin", "Twin XL", "Twin,Twin Xl"],
  "twin xl": ["Twin XL", "Twin,Twin Xl"],
  full: ["Full", "Full,Twin"],
  queen: ["Queen", "Split Head Queen"],
  king: ["King", "Split King", "Split Head King", "California King,King", "California King,King,Queen"],
  "california king": ["California King", "Split California King", "California King,King", "Split California King,Split King"],
  "cal king": ["California King", "Split California King", "California King,King"],
};

function shopperSizeFromInput(input: string): string | null {
  const lower = input.toLowerCase();
  for (const alias of Object.keys(sizeAliases)) {
    if (lower.includes(alias)) return alias;
  }
  return null;
}

function themeHasSize(theme: { availableSizes?: string[] | null }, requestedSize: string): boolean {
  const sizes = theme.availableSizes ?? [];
  if (sizes.length === 0) return true;

  const acceptable = sizeAliases[requestedSize] ?? [];
  const normalizedThemeSizes = sizes.map((s) => s.trim());

  return normalizedThemeSizes.some(
    (s) =>
      s.toLowerCase().includes(requestedSize) ||
      acceptable.some((a) => s.toLowerCase().includes(a.toLowerCase())),
  );
}

function baseScoreThemes(
  combinedInput: string,
  requestedBrand?: string,
  requestedSize?: string | null,
  options?: { premiumIntent?: boolean },
) {
  const premiumIntent = options?.premiumIntent ?? false;

  return mattressThemes
    .filter((theme) => {
      if (!isMattressTheme(theme)) return false;
      if (requestedSize && !themeHasSize(theme, requestedSize)) return false;
      return true;
    })
    .map((theme) => {
      let score = 0;
      const haystack = [theme.displayName, theme.brand, theme.type, theme.comfort, theme.description, theme.themeSummary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (requestedBrand && haystack.includes(requestedBrand)) score += 6;
      if (combinedInput.includes("cool") || combinedInput.includes("hot")) {
        if (haystack.includes("cool") || haystack.includes("foam") || haystack.includes("hybrid")) score += 2;
      }
      if (combinedInput.includes("side")) {
        if (haystack.includes("plush") || haystack.includes("medium")) score += 2;
      }
      if (combinedInput.includes("back")) {
        if (haystack.includes("medium") || haystack.includes("firm")) score += 1;
      }
      if (combinedInput.includes("stomach")) {
        if (haystack.includes("firm")) score += 2;
      }
      if (combinedInput.includes("medium")) {
        if (haystack.includes("medium")) score += 2;
      }
      if (combinedInput.includes("plush") || combinedInput.includes("soft")) {
        if (haystack.includes("plush") || haystack.includes("soft")) score += 2;
      }
      if (combinedInput.includes("firm")) {
        if (haystack.includes("firm")) score += 2;
      }
      if (combinedInput.includes("pressure") || combinedInput.includes("hip") || combinedInput.includes("shoulder")) {
        if (haystack.includes("foam") || haystack.includes("plush") || haystack.includes("medium")) score += 2;
      }
      if (combinedInput.includes("support")) {
        if (theme.supportLevel?.score) score += theme.supportLevel.score / 2;
      }
      if (!premiumIntent && (combinedInput.includes("budget") || combinedInput.includes("under") || combinedInput.includes("$") || combinedInput.includes("value"))) {
        if ((theme.priceRange?.min ?? 999999) < 2000) score += 1;
      }
      if (combinedInput.includes("split king") || combinedInput.includes("twin xl")) {
        if (themeHasSize(theme, "twin xl")) score += 2;
        if (premiumIntent) score += scorePremiumIntent(theme) + 3;
      }
      if (premiumIntent) {
        score += scorePremiumIntent(theme);
      }

      return { theme, score } satisfies RankedCandidate;
    })
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      if (premiumIntent) return (b.theme.priceRange?.min ?? 0) - (a.theme.priceRange?.min ?? 0);
      return (a.theme.priceRange?.min ?? 0) - (b.theme.priceRange?.min ?? 0);
    });
}

function toMatchResult(theme: ThemeRecord, score: number): MatchResult {
  return {
    theme: theme.theme,
    displayName: theme.displayName,
    brand: theme.brand,
    type: theme.type,
    comfort: theme.comfort,
    priceFrom: theme.priceRange?.min ?? null,
    score,
  };
}

async function rerankWithAi({
  candidates,
  shopperMessage,
  memorySummary,
}: {
  candidates: RankedCandidate[];
  shopperMessage: string;
  memorySummary: string;
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
        `You are a mattress matching engine for a premium retail demo. Your job is to rank candidates, not to chat. Use the shopper message, transcript, and memory summary to choose the best 3 mattresses from the provided candidate list. Prioritize fit, not brand prestige. Respect size preference if present. If the shopper is asking about split king or Twin XL for two sleepers, treat that as premium purchase intent and avoid cheap entry-level recommendations unless the shopper explicitly asks for budget/value. Never rank adjustable bases, pillows, or non-mattress products above mattresses. Reply with strict JSON only in this shape: {"rankedThemes":[{"theme":string,"score":number,"reason":string}]}. Keep exactly 3 rankedThemes if possible. Scores should be 0-100. Reasons should be short.\n\n${mattressSellingRules}`,
      messages: [
        {
          role: "user",
          content: `Shopper message: ${shopperMessage || "(empty)"}\nMemory summary: ${memorySummary || "None"}\nCandidates:\n${candidateBlock}`,
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

async function buildSplitRecommendation({
  coupleSetup,
  memorySummary,
}: {
  coupleSetup: CoupleSetup;
  memorySummary: string;
}) {
  const sleeper1Prompt = `Twin XL. Sleeper 1 prefers ${coupleSetup.sleeper1Firmness ?? "medium"}. Split king setup. ${memorySummary}`;
  const sleeper2Prompt = `Twin XL. Sleeper 2 prefers ${coupleSetup.sleeper2Firmness ?? "medium"}. Split king setup. ${memorySummary}`;

  const sleeper1Candidates = baseScoreThemes(sleeper1Prompt.toLowerCase(), undefined, "twin xl", { premiumIntent: true });
  const sleeper2Candidates = baseScoreThemes(sleeper2Prompt.toLowerCase(), undefined, "twin xl", { premiumIntent: true });

  const sleeper1Top = sleeper1Candidates[0] ? toMatchResult(sleeper1Candidates[0].theme, sleeper1Candidates[0].score) : null;
  const sleeper2Top = sleeper2Candidates[0] ? toMatchResult(sleeper2Candidates[0].theme, sleeper2Candidates[0].score) : null;

  return {
    mode: "split" as const,
    split: {
      sleeper1: sleeper1Top,
      sleeper2: sleeper2Top,
      explanation: "A split king keeps the shared king footprint while giving each sleeper their own Twin XL feel and support profile.",
    },
    trace: {
      agent: "split-mattress-match",
      invoked: true,
      requestedSize: "twin xl",
      usedAi: false,
      reason: "Built separate Twin XL recommendations for each sleeper in a split-king flow",
    },
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopperInput = String(body?.message ?? "");
  const memorySummary = String(body?.memorySummary ?? "");
  const coupleSetup = (body?.coupleSetup ?? {}) as CoupleSetup;
  const recommendationIntent = body?.recommendationIntent === "split" ? "split" : "standard";

  if (
    recommendationIntent === "split" &&
    coupleSetup?.couplePath === "split-king" &&
    coupleSetup?.sleeper1Firmness &&
    coupleSetup?.sleeper2Firmness
  ) {
    return NextResponse.json(await buildSplitRecommendation({ coupleSetup, memorySummary }));
  }

  const transcriptText = Array.isArray(body?.conversationTranscript)
    ? body.conversationTranscript
        .slice(-12)
        .map((entry: { role?: string; text?: string }) => `${String(entry.role ?? "user")}: ${String(entry.text ?? "")}`)
        .join(" ")
    : "";
  const combinedInput = `${shopperInput} ${memorySummary} ${transcriptText}`.toLowerCase().trim();

  const requestedBrand = brandTerms.find((brand) => combinedInput.includes(brand));
  const requestedSize = shopperSizeFromInput(combinedInput);
  const premiumIntent =
    recommendationIntent === "split" ||
    coupleSetup?.couplePath === "split-king" ||
    combinedInput.includes("split king") ||
    combinedInput.includes("twin xl");

  const heuristicRanked = baseScoreThemes(combinedInput, requestedBrand, requestedSize, { premiumIntent });
  const topCandidates = heuristicRanked.slice(0, MAX_CANDIDATES_FOR_AI);
  const { usedAi, reranked } = await rerankWithAi({
    candidates: topCandidates,
    shopperMessage: `${String(body?.message ?? "")}\nRecent conversation: ${transcriptText}`,
    memorySummary: String(body?.memorySummary ?? ""),
  });

  const finalRanked = (usedAi ? reranked : topCandidates)
    .slice(0, 3)
    .map(({ theme, score }) => toMatchResult(theme, score));

  return NextResponse.json({
    mode: "standard",
    matches: finalRanked,
    trace: {
      agent: usedAi ? "ai-reranker" : "mattress-match",
      invoked: true,
      requestedSize,
      requestedBrand,
      usedAi,
      candidateCount: topCandidates.length,
      reason: usedAi
        ? "Heuristic pre-filter followed by AI reranking"
        : requestedSize
          ? `Filtered to ${requestedSize} availability and ranked heuristically`
          : requestedBrand
            ? `Shopper asked about ${requestedBrand}; ranked heuristically`
            : "Heuristic ranking only",
    },
  });
}
