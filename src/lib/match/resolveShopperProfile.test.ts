import { describe, expect, it } from "vitest";
import { resolveShopperProfile } from "./resolveShopperProfile";

describe("resolveShopperProfile", () => {
  it("resolves firm heavier side sleeper with mobility priority", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I am a side sleeper, pretty overweight, want a firm mattress, and need easy movement.",
      memorySummary: "Returning shopper is queen-size shopper.",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.sleepPosition).toBe("side");
    expect(profile.firmnessPreference).toBe("firm");
    expect(profile.weightTier).toBe("250_300");
    expect(profile.mobilityPriority).toBe(true);
    expect(profile.excludedComfortBands).toContain("soft");
    expect(profile.excludedComfortBands).toContain("plush");
  });

  it("stays flexible when medium-firm is explicitly acceptable", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I like firm but I am open to trying a medium-firm option.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.firmnessPreference).toBe("firm");
    expect(profile.firmnessRigidity).toBe("flexible");
    expect(profile.rawSignals.mentionedOpenToMediumFirm).toBe(true);
  });

  it("does not over-constrain unknown weight", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I am a side sleeper and want pressure relief.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.weightTier).toBe("unknown");
    expect(profile.supportPriority).toBe(false);
  });
});
