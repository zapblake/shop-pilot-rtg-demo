import { describe, expect, it } from "vitest";
import { resolveShopperProfile } from "./resolveShopperProfile";
import { scoreCandidates } from "./scoreCandidates";

function topComforts(message: string, memorySummary = "") {
  const profile = resolveShopperProfile({
    shopperMessage: message,
    memorySummary,
    conversationTranscript: [],
    coupleSetup: {},
  });

  return scoreCandidates(profile).slice(0, 5).map((candidate) => ({
    displayName: candidate.theme.displayName,
    comfort: candidate.theme.comfort?.toLowerCase() ?? "",
    score: candidate.score,
  }));
}

describe("scoreCandidates", () => {
  it("ranks supportive firm or medium-firm styles above soft options for firm heavier side sleeper with easy movement", () => {
    const top = topComforts("I am a side sleeper, want firm, weigh over 300 pounds, and need easy movement.");

    expect(top.some((item) => /soft|plush/.test(item.comfort))).toBe(false);
    expect(top[0]?.comfort).toMatch(/firm|medium firm|medium-firm/);
  });

  it("keeps explicit firm ahead of generic side sleeper softness bias", () => {
    const top = topComforts("I am a side sleeper and I want a firm mattress.");
    expect(top[0]?.comfort).toMatch(/firm|medium firm|medium-firm/);
    expect(top.slice(0, 3).some((item) => /soft|plush/.test(item.comfort))).toBe(false);
  });

  it("allows balanced pressure-relief options for medium side sleeper", () => {
    const top = topComforts("I am a side sleeper, want medium, and care about pressure relief.");
    expect(top[0]?.comfort).toMatch(/medium/);
  });

  it("unknown weight stays neutral instead of over-constrained", () => {
    const top = topComforts("I am a side sleeper and want medium-firm support.");
    expect(top.length).toBeGreaterThan(0);
    expect(top[0]?.comfort).toMatch(/medium|firm/);
  });

  it("treats firm plus 250-300 mobility as anti-sinky", () => {
    const top = topComforts("I am a heavy side sleeper around 250 and want a firm bed that is easy to move around on.");
    expect(top[0]?.comfort).toMatch(/firm|medium firm|medium-firm/);
    expect(top.slice(0, 5).some((item) => /soft|plush/.test(item.comfort))).toBe(false);
  });
});
