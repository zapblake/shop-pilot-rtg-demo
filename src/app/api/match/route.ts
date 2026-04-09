import { NextResponse } from "next/server";
import mattressThemes from "@/data/mattressThemes.normalized.json";

const brandTerms = ["helix", "sealy", "tempur", "serta", "beautyrest", "purple", "sleepy's", "sleepys"];

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
  if (sizes.length === 0) return true; // no size data, don't filter out

  const acceptable = sizeAliases[requestedSize] ?? [];
  const normalizedThemeSizes = sizes.map((s) => s.trim());

  return normalizedThemeSizes.some(
    (s) =>
      s.toLowerCase().includes(requestedSize) ||
      acceptable.some((a) => s.toLowerCase().includes(a.toLowerCase())),
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopperInput = String(body?.message ?? "").toLowerCase();
  const memorySummary = String(body?.memorySummary ?? "").toLowerCase();
  const combinedInput = `${shopperInput} ${memorySummary}`;

  const requestedBrand = brandTerms.find((brand) => combinedInput.includes(brand));
  const requestedSize = shopperSizeFromInput(combinedInput);

  const ranked = mattressThemes
    .filter((theme) => {
      if (requestedSize && !themeHasSize(theme, requestedSize)) return false;
      return true;
    })
    .map((theme) => {
      let score = 0;
      const haystack = [theme.displayName, theme.brand, theme.type, theme.comfort]
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
      if (combinedInput.includes("medium")) {
        if (haystack.includes("medium")) score += 2;
      }
      if (combinedInput.includes("firm")) {
        if (haystack.includes("firm")) score += 2;
      }
      if (combinedInput.includes("budget") || combinedInput.includes("under") || combinedInput.includes("$")) {
        if ((theme.priceRange?.min ?? 999999) < 2000) score += 1;
      }

      return { theme, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ theme, score }) => ({
      theme: theme.theme,
      displayName: theme.displayName,
      brand: theme.brand,
      type: theme.type,
      comfort: theme.comfort,
      priceFrom: theme.priceRange?.min ?? null,
      score,
    }));

  return NextResponse.json({
    matches: ranked,
    trace: {
      agent: "mattress-match",
      invoked: true,
      requestedSize,
      requestedBrand,
      reason: requestedSize
        ? `Filtered to ${requestedSize} availability`
        : requestedBrand
          ? `Shopper asked about ${requestedBrand}`
          : "Shopper intent suggested recommendation narrowing",
    },
  });
}
