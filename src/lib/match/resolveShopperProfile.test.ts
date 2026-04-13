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

  it("treats explicit brand demand as require", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I want Sealy.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.preferredBrands).toEqual(["sealy"]);
    expect(profile.brandMode).toBe("require");
  });

  it("treats softer brand interest as prefer", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I like Purple.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.preferredBrands).toEqual(["purple"]);
    expect(profile.brandMode).toBe("prefer");
  });

  it("treats carry/about questions as explore", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "Do you carry Tempur-Pedic?",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.preferredBrands).toEqual(["tempurpedic"]);
    expect(profile.brandMode).toBe("explore");
  });

  it("preserves multi-brand narrowing", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "Sealy or Tempur.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.preferredBrands).toEqual(["sealy", "tempurpedic"]);
    expect(profile.rawSignals.mentionedMultipleBrands).toBe(true);
  });

  it("preserves brand intent inside a use case", () => {
    const profile = resolveShopperProfile({
      shopperMessage: "I want a Helix for my child.",
      memorySummary: "",
      conversationTranscript: [],
      coupleSetup: {},
    });

    expect(profile.preferredBrands).toEqual(["helix"]);
    expect(profile.brandMode).toBe("require");
  });
});
