export function extractFinalQuestion(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const boldMatches = [...normalized.matchAll(/\*\*(.*?)\*\*/g)]
    .map((match) => (match[1] ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (let index = boldMatches.length - 1; index >= 0; index -= 1) {
    const candidate = boldMatches[index];
    if (candidate.includes("?")) {
      return candidate;
    }
  }

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) ?? [];
  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    const candidate = sentences[index].replace(/\s+/g, " ").trim();
    if (candidate.endsWith("?")) {
      return candidate;
    }
  }

  return null;
}
