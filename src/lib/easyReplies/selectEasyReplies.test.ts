import { describe, expect, it } from "vitest";
import { selectEasyReplies, type EasyReplyContext } from "./selectEasyReplies";

function makeContext(overrides: Partial<EasyReplyContext> = {}): EasyReplyContext {
  return {
    questionType: null,
    questionText: null,
    currentView: "plp",
    shoppingPhase: "mattress-discovery",
    memorySummary: "",
    matches: [],
    conversationTranscript: [],
    recommendationMode: "standard",
    ...overrides,
  };
}

describe("selectEasyReplies", () => {
  it("returns add-on replies in cart view", () => {
    const replies = selectEasyReplies(makeContext({ currentView: "cart" }));
    expect(replies.map((reply) => reply.label)).toEqual(["Protector", "Sheets", "Pillows", "Base"]);
  });

  it("returns feel support cooling for pdp questions", () => {
    const replies = selectEasyReplies(makeContext({
      currentView: "pdp",
      questionText: "What would you like to evaluate first, feel, support, or cooling?",
    }));
    expect(replies.map((reply) => reply.label)).toEqual(["Feel", "Support", "Cooling"]);
  });

  it("matches explicit compare-refine fallback options in order", () => {
    const replies = selectEasyReplies(makeContext({
      questionType: "compare-refine",
      questionText: "What matters more for the next step, cooler sleep, pressure relief, or easier movement?",
    }));
    expect(replies.map((reply) => reply.label)).toEqual(["Cooling", "Pressure relief", "Easy movement"]);
  });

  it("lets question text win over a wrong questionType", () => {
    const replies = selectEasyReplies(makeContext({
      questionType: "pressure-relief",
      questionText: "What matters most to you next, cooling, pressure relief, support, or feel?",
    }));
    expect(replies.map((reply) => reply.label)).toEqual(["Cooling", "Pressure relief", "Support", "Feel"]);
  });
});
