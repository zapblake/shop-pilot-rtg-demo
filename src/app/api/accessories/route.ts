import { NextResponse } from "next/server";
import accessories from "@/data/accessories.normalized.json";

type AccessoryCategory = "protector" | "sheets" | "pillow" | "base" | "adjustable-base";
type SetupType = "standard" | "split-king";

type AccessoryRecord = (typeof accessories)[number];

type CartMattress = {
  theme?: string;
  displayName?: string;
  size?: string | null;
  priceFrom?: number | null;
};

type AccessoryRecommendation = {
  category: AccessoryCategory;
  primary: {
    theme: string;
    displayName: string;
    brand: string;
    category: AccessoryCategory;
    priceFrom?: number | null;
    heroImage?: string | null;
  } | null;
  explanation: string;
};

const CATEGORY_ORDER: AccessoryCategory[] = ["protector", "sheets", "pillow", "base", "adjustable-base"];

function scoreAccessory({
  item,
  setupType,
  shopperContext,
  cartMattress,
}: {
  item: AccessoryRecord;
  setupType: SetupType;
  shopperContext: string;
  cartMattress: CartMattress | null;
}) {
  let score = 0;
  const tags = [...(item.tags ?? []), ...(item.recommendedFor ?? [])].join(" ").toLowerCase();
  const mattressPrice = cartMattress?.priceFrom ?? 0;

  if ((item.compatibleSetups ?? []).includes(setupType)) score += 5;
  if (setupType === "split-king" && tags.includes("split king")) score += 4;
  if (shopperContext.includes("hot") && tags.includes("cooling")) score += 3;
  if (shopperContext.includes("side") && tags.includes("side sleeper")) score += 3;
  if (shopperContext.includes("pressure") && tags.includes("pressure relief")) score += 3;
  if (shopperContext.includes("back pain") && tags.includes("back pain")) score += 3;
  if (shopperContext.includes("support") && tags.includes("support")) score += 2;
  if (mattressPrice >= 2500 && tags.includes("premium")) score += 2;
  if (mattressPrice > 0 && mattressPrice < 2000 && tags.includes("value")) score += 2;

  if (item.category === "adjustable-base") {
    score += setupType === "split-king" ? 3 : 1;
  }

  return score;
}

function buildExplanation(category: AccessoryCategory, item: AccessoryRecord, setupType: SetupType, shopperContext: string) {
  const tags = [...(item.tags ?? []), ...(item.recommendedFor ?? [])].join(" ").toLowerCase();

  if (category === "protector") {
    if (tags.includes("cooling") && shopperContext.includes("hot")) return "Adds protection without working against the shopper’s cooling priority.";
    return "Rounds out the mattress purchase with a clean, easy protection layer.";
  }

  if (category === "sheets") {
    if (setupType === "split-king") return "This is the cleanest sheet fit for a split king or Twin XL pairing.";
    return "Matches the mattress setup and helps complete the sleep system in one step.";
  }

  if (category === "pillow") {
    if (tags.includes("side sleeper") && shopperContext.includes("side")) return "Fits the shopper’s side-sleeping profile and pressure-relief needs.";
    if (tags.includes("cooling") && shopperContext.includes("hot")) return "Supports the mattress choice while reinforcing a cooler sleep feel.";
    return "Extends the comfort profile of the mattress into the pillow recommendation.";
  }

  if (category === "base") {
    return setupType === "split-king"
      ? "Gives both Twin XL sides a clean foundation for the shared split-king setup."
      : "Provides a simple foundation that keeps the mattress setup complete.";
  }

  return setupType === "split-king"
    ? "Best way to unlock individualized comfort on each side of the split-king setup."
    : "Strong upsell for comfort, support, and a more premium finished setup.";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const memorySummary = String(body?.memorySummary ?? "").toLowerCase();
  const transcriptText = Array.isArray(body?.conversationTranscript)
    ? body.conversationTranscript
        .slice(-12)
        .map((entry: { role?: string; text?: string }) => String(entry.text ?? ""))
        .join(" ")
        .toLowerCase()
    : "";
  const shopperContext = `${memorySummary} ${transcriptText}`.trim();
  const cartMattress = (body?.cartMattress ?? null) as CartMattress | null;
  const setupType = body?.setupType === "split-king" ? "split-king" : "standard";

  const recommendations: AccessoryRecommendation[] = CATEGORY_ORDER.map((category) => {
    const eligible = accessories
      .filter((item) => item.category === category)
      .filter((item) => (item.compatibleSetups ?? []).includes(setupType))
      .sort(
        (a, b) =>
          scoreAccessory({ item: b, setupType, shopperContext, cartMattress }) -
          scoreAccessory({ item: a, setupType, shopperContext, cartMattress }),
      );

    const top = eligible[0] ?? null;

    return {
      category,
      primary: top
        ? {
            theme: top.theme,
            displayName: top.displayName,
            brand: top.brand,
            category: top.category as AccessoryCategory,
            priceFrom: top.priceRange?.min ?? null,
            heroImage: (top as { heroImage?: string | null }).heroImage ?? null,
          }
        : null,
      explanation: top ? buildExplanation(category, top, setupType, shopperContext) : "",
    };
  });

  return NextResponse.json({
    recommendations,
    trace: {
      setupType,
      anchorMattress: cartMattress?.displayName ?? null,
    },
  });
}
