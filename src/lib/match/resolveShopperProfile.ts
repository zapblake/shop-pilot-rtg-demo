import { BrandMode, CoupleSetup, FirmnessPreference, FirmnessRigidity, ResolvedShopperProfile, SleepPosition, WeightTier } from "./types";

type BrandAlias = {
  key: string;
  aliases: string[];
};

const brandAliases: BrandAlias[] = [
  { key: "helix", aliases: ["helix"] },
  { key: "sealy", aliases: ["sealy", "posturepedic", "sealy posturepedic"] },
  { key: "tempurpedic", aliases: ["tempur", "tempurpedic", "tempur-pedic"] },
  { key: "purple", aliases: ["purple"] },
  { key: "beautyrest", aliases: ["beautyrest", "beauty rest"] },
  { key: "stearns & foster", aliases: ["stearns", "stearns and foster", "stearns & foster", "sterns and foster", "sterns & foster"] },
  { key: "serta", aliases: ["serta"] },
  { key: "sleepys", aliases: ["sleepys", "sleepy's"] },
];

const sizeAliases: Record<string, string[]> = {
  twin: ["twin"],
  "twin xl": ["twin xl"],
  full: ["full"],
  queen: ["queen"],
  king: ["king", "split king"],
  "california king": ["california king", "cal king"],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/tempur-pedic/g, "tempurpedic")
    .replace(/stearns\s*&\s*foster/g, "stearns foster")
    .replace(/stearns\s+and\s+foster/g, "stearns foster")
    .replace(/sterns\s*&\s*foster/g, "stearns foster")
    .replace(/sterns\s+and\s+foster/g, "stearns foster")
    .replace(/sleepy'?s/g, "sleepys")
    .replace(/[^a-z0-9+$\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSize(input: string) {
  for (const [size, aliases] of Object.entries(sizeAliases)) {
    if (aliases.some((alias) => input.includes(alias))) return size;
  }
  return null;
}

function resolveSleepPosition(input: string): SleepPosition {
  const side = /side sleeper|sleep on my side|mostly side|primarily side|\bside\b/.test(input);
  const back = /back sleeper|sleep on my back|mostly back|primarily back|\bback\b/.test(input);
  const stomach = /stomach sleeper|sleep on my stomach|mostly stomach|primarily stomach|\bstomach\b/.test(input);
  const count = [side, back, stomach].filter(Boolean).length;

  if (count > 1) return "combination";
  if (side) return "side";
  if (back) return "back";
  if (stomach) return "stomach";
  return "unknown";
}

function resolveFirmnessPreference(input: string): { preference: FirmnessPreference; rigidity: FirmnessRigidity; mentionedOpenToMediumFirm: boolean } {
  const mentionedOpenToMediumFirm = /open to (trying )?(a )?medium(?:\s|-)?firm|medium(?:\s|-)?firm could work|medium(?:\s|-)?firm is fine|medium(?:\s|-)?firm might work/.test(input);
  const explicitFirm = /\bi need firm\b|\bi want firm\b|\bi like firm\b|\bprefer firm\b|\bfirm mattress\b|\bfirm\b/.test(input);
  const explicitMediumFirm = /medium firm|medium-firm/.test(input);
  const explicitMedium = /\bprefer medium\b|\bi want medium\b|\bi like medium\b|\bmedium\b/.test(input);
  const explicitSoft = /\bsoft\b|\bplush\b/.test(input);
  const rejectsSoft = /don'?t want soft|not soft|no plush|don'?t show plush|do not show plush|don'?t want plush/.test(input);

  if (explicitFirm) {
    return {
      preference: explicitMediumFirm && !/\bfirm\b/.test(input.replace(/medium firm|medium-firm/g, "")) ? "medium-firm" : "firm",
      rigidity: mentionedOpenToMediumFirm || explicitMediumFirm ? "flexible" : "hard_requirement",
      mentionedOpenToMediumFirm,
    };
  }

  if (explicitMediumFirm) {
    return {
      preference: "medium-firm",
      rigidity: mentionedOpenToMediumFirm ? "flexible" : "strong_preference",
      mentionedOpenToMediumFirm,
    };
  }

  if (explicitMedium) {
    return { preference: "medium", rigidity: "strong_preference", mentionedOpenToMediumFirm };
  }

  if (explicitSoft) {
    return {
      preference: rejectsSoft ? null : "soft",
      rigidity: "strong_preference",
      mentionedOpenToMediumFirm,
    };
  }

  return { preference: null, rigidity: "flexible", mentionedOpenToMediumFirm };
}

function resolveWeightTier(input: string): WeightTier {
  if (/300\+|over 300|300 pounds|300 lbs|three hundred|very overweight|morbidly obese/.test(input)) return "300_plus";
  if (/250|260|270|280|290|overweight|heavy|heavier|plus size/.test(input)) return "250_300";
  if (/200|210|220|230|240|250 pounds|250 lbs/.test(input)) return "200_250";
  if (/under 200|180|190|185 pounds|185 lbs/.test(input)) return "under_200";
  return "unknown";
}

function resolveBrands(input: string) {
  const found = brandAliases.filter((brand) => brand.aliases.some((alias) => input.includes(alias)));
  return found.map((brand) => brand.key);
}

function resolveBrandMode(input: string, preferredBrands: string[]): BrandMode {
  if (preferredBrands.length === 0) return "none";

  const requirePatterns = [
    /\bi want [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bshow me [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi only want [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi need this brand specifically\b/,
    /\bkeep it to [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
  ];

  const explorePatterns = [
    /\bdo you carry\b/,
    /\bis [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys) good\b/,
    /\btell me about\b/,
    /\bwhat brand is best\b/,
    /\bwhat do you think about\b/,
  ];

  const preferPatterns = [
    /\bi like [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi(?:'ve| have) been looking at [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi(?:'m| am) interested in [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi tend to prefer [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
    /\bi prefer [a-z\s-]*?(sealy|tempurpedic|tempur|helix|purple|beautyrest|serta|stearns foster|sleepys)\b/,
  ];

  if (requirePatterns.some((pattern) => pattern.test(input))) return "require";
  if (preferPatterns.some((pattern) => pattern.test(input))) return "prefer";
  if (explorePatterns.some((pattern) => pattern.test(input))) return "explore";
  if (preferredBrands.length > 0) return "explore";
  return "none";
}

export function resolveShopperProfile({
  shopperMessage,
  memorySummary,
  conversationTranscript,
  coupleSetup,
}: {
  shopperMessage: string;
  memorySummary: string;
  conversationTranscript: { role?: string; text?: string }[];
  coupleSetup: CoupleSetup;
}): ResolvedShopperProfile {
  const transcriptText = conversationTranscript
    .slice(-12)
    .map((entry) => `${String(entry.role ?? "user")}: ${String(entry.text ?? "")}`)
    .join(" ");
  const combined = normalizeText(`${shopperMessage} ${memorySummary} ${transcriptText}`);
  const firmness = resolveFirmnessPreference(combined);
  const weightTier = resolveWeightTier(combined);
  const mobilityPriority = /easy movement|easier movement|move around|reposition|mobility|not feel stuck|get in and out|getting in and out/.test(combined);
  const pressureReliefPriority = /pressure relief|pressure points|shoulder pain|hip pain|hips|shoulders/.test(combined);
  const coolingPriority = /sleep hot|hot sleeper|cooling|cooler sleep|temperature/.test(combined);
  const supportPriority = /support|alignment|back support|lumbar|sturdy|strong support/.test(combined)
    || weightTier === "250_300"
    || weightTier === "300_plus"
    || mobilityPriority;
  const budgetSensitivity = /budget|under\s*\$|under\s*\d+|value|affordable|cheapest/.test(combined);
  const preferredBrands = resolveBrands(combined);
  const brandMode = resolveBrandMode(combined, preferredBrands);
  const size = resolveSize(combined);
  const sleepPosition = resolveSleepPosition(combined);
  const excludedComfortBands = new Set<string>();

  if (firmness.preference === "firm" || firmness.preference === "medium-firm") {
    excludedComfortBands.add("soft");
    excludedComfortBands.add("plush");
  }

  if ((weightTier === "250_300" || weightTier === "300_plus") && mobilityPriority) {
    excludedComfortBands.add("soft");
    excludedComfortBands.add("plush");
  }

  const mentionsSplit = /split king|twin xl/.test(combined) || coupleSetup.couplePath === "split-king";
  const premiumIntent = !budgetSensitivity && (mentionsSplit || /luxury|premium/.test(combined));

  return {
    size,
    sleepPosition,
    firmnessPreference: firmness.preference,
    firmnessRigidity: firmness.rigidity,
    weightTier,
    mobilityPriority,
    pressureReliefPriority,
    coolingPriority,
    supportPriority,
    budgetSensitivity,
    preferredBrands,
    brandMode,
    excludedComfortBands: Array.from(excludedComfortBands),
    coupleContext: coupleSetup,
    premiumIntent,
    rawSignals: {
      mentionsSplit,
      mentionsWeight: weightTier !== "unknown",
      mentionedOpenToMediumFirm: firmness.mentionedOpenToMediumFirm,
      mentionedMultipleBrands: preferredBrands.length > 1,
    },
  };
}
