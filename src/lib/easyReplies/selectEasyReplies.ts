export type EasyReply = { label: string; message: string };

export type EasyReplyQuestionType =
  | "size"
  | "shopper-mode"
  | "king-path"
  | "firmness"
  | "sleep-position"
  | "cooling"
  | "pressure-relief"
  | "budget"
  | "compare-refine"
  | "generic-refine"
  | null;

export type EasyReplyContext = {
  questionType: EasyReplyQuestionType;
  questionText: string | null;
  currentView: "plp" | "pdp" | "cart";
  shoppingPhase: "mattress-discovery" | "post-cart-accessories";
  memorySummary: string;
  matches: Array<{
    theme: string;
    displayName: string;
    brand: string;
    type?: string | null;
    comfort?: string | null;
    priceFrom?: number | null;
    score: number;
  }>;
  conversationTranscript: Array<{ role: "assistant" | "user"; text: string }>;
  recommendationMode: "standard" | "split";
};

const splitReplies: EasyReply[] = [
  { label: "More pressure relief", message: "We want more pressure relief on one side." },
  { label: "More support", message: "One sleeper needs stronger support." },
  { label: "Adjustable base", message: "We also want to know if this works with an adjustable base." },
];

const cartReplies: EasyReply[] = [
  { label: "Protector", message: "I want a protector first." },
  { label: "Sheets", message: "Show me sheets that fit this setup." },
  { label: "Pillows", message: "Help me pick pillows next." },
  { label: "Base", message: "I need a base." },
  { label: "Adjustable base", message: "I want an adjustable base." },
];

const pdpReplies: EasyReply[] = [
  { label: "Feel", message: "Help me evaluate the feel first." },
  { label: "Support", message: "Help me evaluate support first." },
  { label: "Cooling", message: "Help me evaluate cooling first." },
];

const optionCatalog = [
  {
    key: "COOLING",
    pattern: /(cooler sleep|cooling|sleep hot|temperature|hot)/i,
    reply: { label: "Cooling", message: "Cooling matters most to me." },
  },
  {
    key: "PRESSURE_RELIEF",
    pattern: /(pressure relief|shoulder|hip)/i,
    reply: { label: "Pressure relief", message: "Pressure relief matters most to me." },
  },
  {
    key: "SUPPORT",
    pattern: /(support|back pain|alignment)/i,
    reply: { label: "Support", message: "Support matters most to me." },
  },
  {
    key: "FEEL",
    pattern: /(feel|firmness|plush|medium|firm|soft)/i,
    reply: { label: "Feel", message: "Feel matters most to me." },
  },
  {
    key: "EASY_MOVEMENT",
    pattern: /(easy movement|move around|easier movement)/i,
    reply: { label: "Easy movement", message: "I want it to be easy to move around on." },
  },
  {
    key: "BUDGET",
    pattern: /(value|budget|premium|price)/i,
    reply: { label: "Budget", message: "Value matters most to me." },
  },
  {
    key: "ADD_ONS",
    pattern: /(protector|sheets|pillow|pillows|base|adjustable)/i,
    reply: { label: "Add-ons", message: "Show me the best add-on options." },
  },
] as const;

function transcriptText(ctx: EasyReplyContext) {
  return `${ctx.memorySummary} ${ctx.conversationTranscript.map((entry) => entry.text).join(" ")}`.toLowerCase();
}

function selectCartReplies(ctx: EasyReplyContext) {
  const lower = transcriptText(ctx);
  return cartReplies.filter((reply) => {
    if (reply.label === "Protector") return !/protector/.test(lower);
    if (reply.label === "Sheets") return !/sheet/.test(lower);
    if (reply.label === "Pillows") return !/pillow/.test(lower);
    if (reply.label === "Base") return !/(^|\W)base(\W|$)/.test(lower) || /adjustable base/.test(lower);
    if (reply.label === "Adjustable base") return !/adjustable base/.test(lower);
    return true;
  }).slice(0, 4);
}

function parseExplicitOptions(questionText: string): EasyReply[] {
  const hits = optionCatalog
    .map((entry) => ({ ...entry, index: questionText.search(entry.pattern) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);

  const unique: EasyReply[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    unique.push(hit.reply);
  }

  return unique.length >= 2 ? unique : [];
}

function mapStructuredReplies(questionType: EasyReplyQuestionType): EasyReply[] {
  switch (questionType) {
    case "size":
      return [
        { label: "Queen", message: "I’m looking for a queen." },
        { label: "King", message: "I’m looking for a king." },
        { label: "Not sure", message: "I’m not sure on size yet." },
      ];
    case "shopper-mode":
      return [
        { label: "Just me", message: "Just me." },
        { label: "Two sleepers", message: "Two sleepers." },
        { label: "Different preferences", message: "Two sleepers with different preferences." },
      ];
    case "king-path":
      return [
        { label: "One mattress", message: "We want one mattress that works for both of us." },
        { label: "Split king", message: "We want to explore a split king / Twin XL setup." },
        { label: "Not sure yet", message: "We are not sure yet." },
      ];
    case "firmness":
      return [
        { label: "Plush", message: "I want a plush feel." },
        { label: "Medium", message: "I want a medium feel." },
        { label: "Firm", message: "I want a firm feel." },
      ];
    case "sleep-position":
      return [
        { label: "Side sleeper", message: "I’m a side sleeper." },
        { label: "Back sleeper", message: "I’m a back sleeper." },
        { label: "Stomach sleeper", message: "I’m a stomach sleeper." },
      ];
    case "cooling":
      return [
        { label: "Yes, I sleep hot", message: "Yes, I sleep hot at night." },
        { label: "Somewhat", message: "Somewhat, cooling matters to me." },
        { label: "Not really", message: "No, temperature is not a big factor." },
      ];
    case "pressure-relief":
      return [
        { label: "Shoulder pressure", message: "I need pressure relief at my shoulders." },
        { label: "Hip pressure", message: "I need pressure relief at my hips." },
        { label: "Lower back", message: "Lower back support matters most to me." },
      ];
    case "budget":
      return [
        { label: "Best value", message: "I care most about getting the best value." },
        { label: "Mid-range", message: "I want something solid in the middle." },
        { label: "Premium", message: "I’m open to premium options if the fit is better." },
      ];
    case "compare-refine":
      return [
        { label: "Cooling", message: "Cooling matters most to me." },
        { label: "Pressure relief", message: "Pressure relief matters most to me." },
        { label: "Easy movement", message: "I want it to be easy to move around on." },
      ];
    default:
      return [];
  }
}

export function selectEasyReplies(ctx: EasyReplyContext): EasyReply[] {
  if (ctx.recommendationMode === "split") return splitReplies;

  if (ctx.currentView === "cart" || ctx.shoppingPhase === "post-cart-accessories") {
    return selectCartReplies(ctx);
  }

  const normalizedQuestion = ctx.questionText?.toLowerCase().trim() ?? "";

  if (ctx.currentView === "pdp") {
    if (/(feel|support|cooling|temperature|sleep hot)/i.test(normalizedQuestion)) {
      const explicit = parseExplicitOptions(normalizedQuestion);
      return explicit.length ? explicit.slice(0, 3) : pdpReplies;
    }
    return pdpReplies;
  }

  if (normalizedQuestion) {
    const explicit = parseExplicitOptions(normalizedQuestion);
    if (explicit.length) return explicit.slice(0, 5);
  }

  const fallback = mapStructuredReplies(ctx.questionType);
  if (fallback.length) return fallback;

  return [];
}
