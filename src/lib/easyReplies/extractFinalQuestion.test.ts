import { describe, expect, it } from "vitest";
import { extractFinalQuestion } from "./extractFinalQuestion";

describe("extractFinalQuestion", () => {
  it("extracts the last bolded question", () => {
    expect(extractFinalQuestion("Intro. **First question?** More. **Final question?**")).toBe("Final question?");
  });

  it("extracts the last non-bold question sentence", () => {
    expect(extractFinalQuestion("Intro sentence. What matters most right now?"))
      .toBe("What matters most right now?");
  });

  it("ignores non-question bold segments and chooses the last bold question", () => {
    expect(extractFinalQuestion("**Not a question** Copy. **Do you want cooling or support?**"))
      .toBe("Do you want cooling or support?");
  });
});
