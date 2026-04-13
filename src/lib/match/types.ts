import mattressThemes from "@/data/mattressThemes.normalized.json";

export type ThemeRecord = (typeof mattressThemes)[number];

export type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

export type CoupleSetup = {
  shopperMode?: "single" | "two-similar" | "two-different" | null;
  couplePath?: "compromise" | "split-king" | null;
  sleeper1Firmness?: string | null;
  sleeper2Firmness?: string | null;
};

export type FirmnessPreference = "soft" | "medium" | "medium-firm" | "firm" | null;
export type FirmnessRigidity = "hard_requirement" | "strong_preference" | "flexible";
export type WeightTier = "unknown" | "under_200" | "200_250" | "250_300" | "300_plus";
export type SleepPosition = "side" | "back" | "stomach" | "combination" | "unknown";
export type BrandMode = "none" | "explore" | "prefer" | "require";

export type ResolvedShopperProfile = {
  size: string | null;
  sleepPosition: SleepPosition;
  firmnessPreference: FirmnessPreference;
  firmnessRigidity: FirmnessRigidity;
  weightTier: WeightTier;
  mobilityPriority: boolean;
  pressureReliefPriority: boolean;
  coolingPriority: boolean;
  supportPriority: boolean;
  budgetSensitivity: boolean;
  preferredBrands: string[];
  brandMode: BrandMode;
  excludedComfortBands: string[];
  coupleContext: CoupleSetup;
  premiumIntent: boolean;
  rawSignals: {
    mentionsSplit: boolean;
    mentionsWeight: boolean;
    mentionedOpenToMediumFirm: boolean;
    mentionedMultipleBrands: boolean;
  };
};

export type RankedCandidate = {
  theme: ThemeRecord;
  score: number;
  reasons: string[];
};
