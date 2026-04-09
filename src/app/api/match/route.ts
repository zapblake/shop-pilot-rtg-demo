import { NextResponse } from "next/server";
import mattressThemes from "@/data/mattressThemes.normalized.json";

const brandTerms = ["helix", "sealy", "tempur", "serta", "beautyrest", "purple", "sleepy's", "sleepys"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopperInput = String(body?.message ?? "").toLowerCase();
  const requestedBrand = brandTerms.find((brand) => shopperInput.includes(brand));

  const ranked = mattressThemes
    .map((theme) => {
      let score = 0;
      const haystack = [theme.displayName, theme.brand, theme.type, theme.comfort]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (requestedBrand && haystack.includes(requestedBrand)) score += 6;
      if (shopperInput.includes("cool") || shopperInput.includes("hot")) {
        if (haystack.includes("cool") || haystack.includes("foam") || haystack.includes("hybrid")) score += 2;
      }
      if (shopperInput.includes("side")) {
        if (haystack.includes("plush") || haystack.includes("medium")) score += 2;
      }
      if (shopperInput.includes("medium")) {
        if (haystack.includes("medium")) score += 2;
      }
      if (shopperInput.includes("firm")) {
        if (haystack.includes("firm")) score += 2;
      }
      if (shopperInput.includes("budget") || shopperInput.includes("under") || shopperInput.includes("$")) {
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
      reason: requestedBrand
        ? `Shopper asked about ${requestedBrand}`
        : "Shopper intent suggested recommendation narrowing",
    },
  });
}
