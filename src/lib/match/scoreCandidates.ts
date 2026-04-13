import mattressThemes from "../../data/mattressThemes.normalized.json";
import { MatchResult, RankedCandidate, ResolvedShopperProfile, ThemeRecord } from "./types";

const sizeAliases: Record<string, string[]> = {
  twin: ["Twin", "Twin XL", "Twin,Twin Xl"],
  "twin xl": ["Twin XL", "Twin,Twin Xl"],
  full: ["Full", "Full,Twin"],
  queen: ["Queen", "Split Head Queen"],
  king: ["King", "Split King", "Split Head King", "California King,King", "California King,King,Queen"],
  "california king": ["California King", "Split California King", "California King,King", "Split California King,Split King"],
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
  if (price > 0 && price < 1200) score -= 3;
  if (price >= 1800) score += 1;

  return score;
}

function scoreValueBias(theme: ThemeRecord) {
  const price = theme.priceRange?.min ?? 0;
  if (price > 0 && price < 1200) return 2;
  if (price < 1800) return 1;
  return 0;
}

function describe(theme: ThemeRecord) {
  return [theme.displayName, theme.brand, theme.type, theme.comfort, theme.description, theme.themeSummary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function comfortBand(theme: ThemeRecord) {
  return `${theme.comfort ?? ""} ${theme.type ?? ""} ${theme.displayName ?? ""}`.toLowerCase();
}

function supportScore(theme: ThemeRecord) {
  return theme.supportLevel?.score ?? 0;
}

function pressureScore(theme: ThemeRecord) {
  return theme.pressureRelief?.score ?? 0;
}

function coolingScore(theme: ThemeRecord) {
  return theme.temperatureManagement?.score ?? 0;
}

function isSoft(theme: ThemeRecord) {
  const band = comfortBand(theme);
  return /soft|plush/.test(band);
}

function isMedium(theme: ThemeRecord) {
  const band = comfortBand(theme);
  return /medium/.test(band) && !/medium firm|medium-firm/.test(band);
}

function isMediumFirm(theme: ThemeRecord) {
  return /medium firm|medium-firm/.test(comfortBand(theme));
}

function isFirm(theme: ThemeRecord) {
  const band = comfortBand(theme);
  return /firm/.test(band);
}

function isSinky(theme: ThemeRecord) {
  const searchable = describe(theme);
  return /soft|plush|pillow top|memory foam/.test(searchable) && supportScore(theme) <= 3;
}

export function scoreCandidates(profile: ResolvedShopperProfile) {
  return mattressThemes
    .filter((theme) => {
      if (!isMattressTheme(theme)) return false;
      if (profile.size && !themeHasSize(theme, profile.size)) return false;
      return true;
    })
    .map((theme) => {
      let score = 0;
      const reasons: string[] = [];
      const searchable = describe(theme);
      const price = theme.priceRange?.min ?? 0;
      const support = supportScore(theme);
      const pressure = pressureScore(theme);
      const cooling = coolingScore(theme);

      if (profile.preferredBrands.some((brand) => searchable.includes(brand))) {
        score += 6;
        reasons.push("brand-match");
      }

      if (profile.firmnessPreference === "firm") {
        if (isFirm(theme)) {
          score += 9;
          reasons.push("firm-match");
        } else if (isMediumFirm(theme) && profile.firmnessRigidity !== "hard_requirement") {
          score += 4;
          reasons.push("medium-firm-fallback");
        } else if (isMedium(theme)) {
          score -= profile.firmnessRigidity === "hard_requirement" ? 5 : 2;
        } else if (isSoft(theme)) {
          score -= 9;
          reasons.push("too-soft-for-firm-shopper");
        }
      }

      if (profile.firmnessPreference === "medium-firm") {
        if (isMediumFirm(theme)) {
          score += 8;
          reasons.push("medium-firm-match");
        } else if (isFirm(theme)) {
          score += 3;
        } else if (isMedium(theme)) {
          score += 2;
        } else if (isSoft(theme)) {
          score -= 6;
        }
      }

      if (profile.firmnessPreference === "medium") {
        if (isMedium(theme)) score += 7;
        else if (isMediumFirm(theme)) score += 4;
        else if (isSoft(theme)) score += 2;
      }

      if (profile.sleepPosition === "side") {
        if (profile.firmnessPreference === "firm" || profile.firmnessPreference === "medium-firm") {
          if (pressure >= 4) {
            score += 4;
            reasons.push("side-pressure-relief-with-support");
          }
          if (support >= 4) {
            score += 4;
            reasons.push("side-support");
          }
          if (isSoft(theme)) score -= 5;
        } else {
          if (isMedium(theme) || isMediumFirm(theme)) score += 4;
          if (pressure >= 4) score += 3;
          if (isSoft(theme) && profile.weightTier === "unknown") score += 1;
        }
      }

      if (profile.sleepPosition === "back") {
        if (isFirm(theme) || isMediumFirm(theme)) score += 4;
        if (support >= 4) score += 3;
      }

      if (profile.sleepPosition === "stomach") {
        if (isFirm(theme)) score += 6;
        if (support >= 4) score += 3;
        if (isSoft(theme)) score -= 6;
      }

      if (profile.weightTier === "250_300") {
        score += support >= 4 ? 5 : -2;
        if (isSoft(theme)) score -= 4;
        if (price > 0 && price < 1000) score -= 2;
        reasons.push("higher-weight-support");
      }

      if (profile.weightTier === "300_plus") {
        score += support >= 4 ? 7 : -4;
        if (isFirm(theme) || isMediumFirm(theme)) score += 4;
        if (isSoft(theme)) score -= 8;
        if (isSinky(theme)) score -= 7;
        if (price > 0 && price < 1200) score -= 3;
        reasons.push("300-plus-support-envelope");
      }

      if (profile.mobilityPriority) {
        if (isFirm(theme) || isMediumFirm(theme)) score += 5;
        if (support >= 4) score += 3;
        if (isSinky(theme)) score -= 7;
        reasons.push("mobility-priority");
      }

      if (profile.pressureReliefPriority) {
        if (pressure >= 4) score += 4;
        else if (pressure <= 2) score -= 2;
      }

      if (profile.coolingPriority) {
        if (cooling >= 4) score += 4;
        else if (/hybrid|cool/.test(searchable)) score += 2;
      }

      if (profile.supportPriority) {
        if (support >= 4) score += 4;
        else if (support <= 2) score -= 3;
      }

      if (profile.excludedComfortBands.some((band) => searchable.includes(band))) {
        score -= 6;
      }

      if (profile.budgetSensitivity) {
        score += scoreValueBias(theme);
      } else {
        if (profile.premiumIntent) score += scorePremiumIntent(theme);
        else if (price > 0 && price < 900) score -= 2;
      }

      return { theme, score, reasons } satisfies RankedCandidate;
    })
    .sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      if (profile.budgetSensitivity) return (a.theme.priceRange?.min ?? 0) - (b.theme.priceRange?.min ?? 0);
      return (b.theme.supportLevel?.score ?? 0) - (a.theme.supportLevel?.score ?? 0)
        || (b.theme.priceRange?.min ?? 0) - (a.theme.priceRange?.min ?? 0);
    });
}

export function toMatchResult(theme: ThemeRecord, score: number): MatchResult {
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
