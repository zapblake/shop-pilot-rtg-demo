"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import mattressThemes from "@/data/mattressThemes.normalized.json";
import { extractFinalQuestion } from "@/lib/easyReplies/extractFinalQuestion";
import { selectEasyReplies } from "@/lib/easyReplies/selectEasyReplies";
import styles from "./page.module.css";

type ConversationMode =
  | "welcome"
  | "guided-discovery"
  | "product-evaluation"
  | "comparison"
  | "resume";

type ShopperMemory = {
  shopperId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  summary: string;
};

type QuestionType =
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

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type MessageOptions = {
  skipAssistantReply?: boolean;
  overrideMemorySummary?: string;
  skipBackgroundMatch?: boolean;
  siteContextOnly?: boolean;
};

type MatchResult = {
  theme: string;
  displayName: string;
  brand: string;
  type?: string | null;
  comfort?: string | null;
  priceFrom?: number | null;
  score: number;
};

type RecommendationMode = "standard" | "split";
type ShoppingPhase = "mattress-discovery" | "post-cart-accessories";
type AccessoryCategory = "protector" | "sheets" | "pillow" | "base" | "adjustable-base";

type SplitRecommendation = {
  sleeper1: MatchResult | null;
  sleeper2: MatchResult | null;
  explanation: string;
};

type AccessoryRecommendation = {
  category: AccessoryCategory;
  primary: {
    theme: string;
    displayName: string;
    brand: string;
    category: AccessoryCategory;
    priceFrom?: number | null;
  } | null;
  explanation: string;
};

type CartItem = {
  kind: "mattress" | AccessoryCategory;
  theme: string;
  displayName: string;
  size?: string | null;
  priceFrom?: number | null;
};

type CartContext = {
  mattress: CartItem | null;
  accessories: CartItem[];
};

type DemoView = "plp" | "pdp" | "cart";

type ActiveProductContext = {
  theme: string;
  source: "recommendation" | "featured" | "compare" | "split";
  reason: string | null;
};

type ShopperMode = "single" | "two-similar" | "two-different" | null;
type CouplePath = "compromise" | "split-king" | null;

type CoupleSetup = {
  shopperMode: ShopperMode;
  couplePath: CouplePath;
  sleeper1Firmness: string | null;
  sleeper2Firmness: string | null;
};

type PersistedSession = {
  shoppingPhase: ShoppingPhase;
  cartContext: CartContext;
  accessoryRecommendations: AccessoryRecommendation[];
  messages: ChatMessage[];
  matches: MatchResult[];
  splitRecommendation: SplitRecommendation | null;
  recommendationMode: RecommendationMode;
  conversationMode: ConversationMode;
  currentTheme: string | null;
  currentView: DemoView;
  activeProduct: ActiveProductContext | null;
  activeQuestionType: QuestionType;
  memorySummary: string;
  selectedSize: string | null;
  selectedFirmnessValue: number;
  sizeCapturedViaPill: boolean;
  firmnessAnswered: boolean;
  coupleSetup: CoupleSetup;
};

type ThemeRecord = (typeof mattressThemes)[number];

const featuredThemes = mattressThemes.slice(0, 6);
const SHOPPER_COOKIE_KEY = "shop-pilot-demo-shopper";
const SHOPPER_SESSION_KEY = "shop-pilot-demo-session";
const brandLogos = [
  "https://assets.roomstogo.com/v2/MT_Logo_250w_TempurPedic.png?q=70",
  "https://assets.roomstogo.com/v2/MT_Logo_250w_Beautyrest.png?q=70",
  "https://assets.roomstogo.com/v2/MT_Logo_250w_Helix.png?q=70",
  "https://assets.roomstogo.com/v2/MT_Logo_250w_Sealy.png?q=70",
  "https://assets.roomstogo.com/v2/MT_Logo_250w_Serta.png?q=70",
  "https://assets.roomstogo.com/v2/MT_Logo_250w_Casper.png?q=70",
];
const sizeIcons = [
  ["King", "https://assets.roomstogo.com/v2/MT_Icon_King.svg?q=70"],
  ["Queen", "https://assets.roomstogo.com/v2/MT_Icon_Queen.svg?q=70"],
  ["Full", "https://assets.roomstogo.com/v2/MT_Icon_Full.svg?q=70"],
  ["Twin", "https://assets.roomstogo.com/v2/MT_Icon_Twin.svg?q=70"],
] as const;
const starterMessages: ChatMessage[] = [
  {
    id: "assistant-1",
    role: "assistant",
    text: "👋 Hi, I’m Shop Pilot. I can help you narrow things down without making this feel like homework. **What size mattress are you looking for?**",
  },
];
const starterMatches: MatchResult[] = [];
const defaultCoupleSetup: CoupleSetup = {
  shopperMode: null,
  couplePath: null,
  sleeper1Firmness: null,
  sleeper2Firmness: null,
};
const defaultSplitRecommendation: SplitRecommendation | null = null;
const defaultCartContext: CartContext = { mattress: null, accessories: [] };
const startingSizeOptions = ["Queen", "King", "Not Sure", "Other"];
const otherSizeOptions = ["California King", "Full", "Twin", "Twin XL", "RV King", "Short Queen"];
const firmnessStops = [
  { value: 0, label: "Plush" },
  { value: 25, label: "Medium-plush" },
  { value: 50, label: "Medium" },
  { value: 75, label: "Medium-firm" },
  { value: 100, label: "Firm" },
];
const shopperModeOptions = [
  { value: "single", label: "Just me" },
  { value: "two-similar", label: "Two sleepers, similar preferences" },
  { value: "two-different", label: "Two sleepers, different preferences" },
] as const;
const couplePathOptions = [
  { value: "compromise", label: "Find one mattress that works for both of us" },
  { value: "split-king", label: "Explore a split king / Twin XL setup" },
] as const;
const splitFirmnessOptions = ["Plush", "Medium", "Firm"] as const;

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getStoredSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SHOPPER_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    return {
      shoppingPhase: parsed.shoppingPhase ?? "mattress-discovery",
      cartContext: parsed.cartContext ?? defaultCartContext,
      accessoryRecommendations: parsed.accessoryRecommendations ?? [],
      messages: parsed.messages ?? starterMessages,
      matches: parsed.matches ?? starterMatches,
      splitRecommendation: parsed.splitRecommendation ?? defaultSplitRecommendation,
      recommendationMode: parsed.recommendationMode ?? "standard",
      conversationMode: parsed.conversationMode ?? "guided-discovery",
      currentTheme: parsed.currentTheme ?? featuredThemes[0]?.theme ?? null,
      currentView: parsed.currentView ?? "plp",
      activeProduct: parsed.activeProduct ?? null,
      activeQuestionType: parsed.activeQuestionType ?? "size",
      memorySummary: parsed.memorySummary ?? buildMemorySummary(starterMessages, starterMatches),
      selectedSize: parsed.selectedSize ?? null,
      selectedFirmnessValue: parsed.selectedFirmnessValue ?? 50,
      sizeCapturedViaPill: parsed.sizeCapturedViaPill ?? false,
      firmnessAnswered: parsed.firmnessAnswered ?? false,
      coupleSetup: {
        ...defaultCoupleSetup,
        ...(parsed.coupleSetup ?? {}),
      },
    } satisfies PersistedSession;
  } catch {
    return null;
  }
}

function buildMemorySummary(messages: ChatMessage[], matches: MatchResult[]) {
  const userText = messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.text)
    .join(" ")
    .toLowerCase();

  const preferences = [
    userText.includes("side") ? "side-sleeper" : null,
    userText.includes("back") ? "back-sleeper" : null,
    userText.includes("hot") || userText.includes("cool") ? "cooling-conscious" : null,
    userText.includes("queen") ? "queen-size shopper" : null,
    userText.includes("king") ? "king-size shopper" : null,
    userText.includes("two sleepers") || userText.includes("split king") ? "couples-shopping" : null,
    userText.includes("budget") || userText.includes("under") || userText.includes("$") ? "budget-aware" : null,
    userText.includes("pressure") ? "pressure-relief focused" : null,
  ].filter(Boolean);

  const topMatch = matches[0]?.displayName;
  const preferenceText = preferences.length ? preferences.join(", ") : "preferences still emerging";

  return topMatch
    ? `Returning shopper is ${preferenceText}. Current lead recommendation: ${topMatch}.`
    : `Returning shopper is ${preferenceText}. No lead recommendation yet.`;
}

function getFitReasons(match: MatchResult, summary: string) {
  const reasons = [];
  const lowerSummary = summary.toLowerCase();
  const descriptor = [match.type, match.comfort, match.displayName].join(" ").toLowerCase();

  if ((lowerSummary.includes("cool") || lowerSummary.includes("hot")) && descriptor.match(/cool|foam|hybrid/)) {
    reasons.push("Cooling fit");
  }
  if (lowerSummary.includes("side") && descriptor.match(/plush|medium/)) {
    reasons.push("Great for side sleeping");
  }
  if (lowerSummary.includes("back") && descriptor.match(/firm|medium|hybrid/)) {
    reasons.push("Steady back support");
  }
  if (lowerSummary.includes("motion") || lowerSummary.includes("partner")) {
    reasons.push("Helps limit motion transfer");
  }
  if (lowerSummary.includes("pressure") && descriptor.match(/foam|plush|medium/)) {
    reasons.push("Pressure-relief friendly");
  }
  if (lowerSummary.includes("split king") || lowerSummary.includes("two sleepers")) {
    reasons.push("Works in a split setup");
  }
  if (lowerSummary.includes("budget") || lowerSummary.includes("under") || lowerSummary.includes("$") || lowerSummary.includes("budget-aware")) {
    if ((match.priceFrom ?? 999999) < 2000) reasons.push("Budget aligned");
  }
  if (!reasons.length) reasons.push("Strong overall match");

  return reasons.slice(0, 3);
}

function getRecommendationTierLabel(index: number) {
  if (index === 0) return "Best Match";
  if (index === 1) return "Great Alternative";
  return "Value Option";
}

function getRecommendationTierSubcopy(index: number) {
  if (index === 0) return "The clearest fit based on the shopper's stated priorities.";
  if (index === 1) return "A strong backup if they want a slightly different feel or finish.";
  return "A more pragmatic path that still covers the core needs.";
}

function buildRecommendationWhy(match: MatchResult, summary: string, index: number) {
  const lowerSummary = summary.toLowerCase();
  const fitReasons = getFitReasons(match, summary);
  const benefitLead = fitReasons[0] ?? "Strong overall match";

  if (index === 0) {
    if (lowerSummary.includes("side")) return `${benefitLead}, with a feel that should keep side-sleep pressure points calmer through the night.`;
    if (lowerSummary.includes("back")) return `${benefitLead}, with the kind of support that keeps the shopper feeling more level and steady.`;
    if (lowerSummary.includes("cool") || lowerSummary.includes("hot")) return `${benefitLead}, with a cooler, less stuffy sleep experience front and centre.`;
    return `${benefitLead}, making this the most complete recommendation for the shopper's current brief.`;
  }

  if (index === 1) {
    return `${benefitLead}, but with a slightly different comfort profile for shoppers who want another premium direction.`;
  }

  return `${benefitLead}, while keeping the recommendation set grounded in a more value-conscious option.`;
}

function getComparisonNote(matches: MatchResult[], mode: ConversationMode, recommendationMode: RecommendationMode) {
  if (recommendationMode === "split") return "Each sleeper now has an individual Twin XL recommendation while keeping one shared split-king setup.";
  if (mode !== "comparison" || matches.length < 2) return null;

  return `${matches[0].displayName} leads right now, with ${matches[1].displayName} as the best alternate depending on whether the shopper prioritizes feel or value.`;
}

function getThemeDetails(themeName: string | null) {
  if (!themeName) return null;
  return mattressThemes.find((theme) => theme.theme === themeName) ?? null;
}

function getMatchTheme(match: MatchResult) {
  return getThemeDetails(match.theme);
}

function getFeatureScore(label: string | null | undefined) {
  if (!label) return 0;
  const lookup: Record<string, number> = {
    ultimate: 5,
    premier: 4,
    enhanced: 3,
    core: 2,
    basic: 1,
  };
  return lookup[label.toLowerCase()] ?? 0;
}

function getBestFor(theme: ThemeRecord) {
  const positions = theme.bestForSleepPositions?.length
    ? theme.bestForSleepPositions.join(", ")
    : "most sleep styles";
  return `Best for ${positions}`;
}

function renderMessageText(text: string) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const parts = block.split(/(\*\*.*?\*\*)/g).filter(Boolean);

    return (
      <p key={`block-${blockIndex}`}>
        {parts.map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
          }
          return <span key={`${part}-${index}`}>{part}</span>;
        })}
      </p>
    );
  });
}

async function fetchMatches({
  message,
  memorySummary,
  conversationTranscript,
  recommendationIntent,
  coupleSetup,
}: {
  message: string;
  memorySummary: string;
  conversationTranscript: ChatMessage[];
  recommendationIntent: RecommendationMode;
  coupleSetup: CoupleSetup;
}) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      memorySummary,
      conversationTranscript: conversationTranscript.map(({ role, text }) => ({ role, text })),
      recommendationIntent,
      coupleSetup,
    }),
  });

  return response.json();
}

async function fetchAccessories({
  cartMattress,
  memorySummary,
  conversationTranscript,
  setupType,
}: {
  cartMattress: CartItem;
  memorySummary: string;
  conversationTranscript: ChatMessage[];
  setupType: "standard" | "split-king";
}) {
  const response = await fetch("/api/accessories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cartMattress,
      memorySummary,
      conversationTranscript: conversationTranscript.map(({ role, text }) => ({ role, text })),
      setupType,
    }),
  });

  return response.json();
}

function buildSplitReasonList(splitRecommendation: SplitRecommendation) {
  return [
    splitRecommendation.sleeper1 ? `Sleeper 1: ${splitRecommendation.sleeper1.displayName}` : null,
    splitRecommendation.sleeper2 ? `Sleeper 2: ${splitRecommendation.sleeper2.displayName}` : null,
    splitRecommendation.explanation,
  ].filter(Boolean) as string[];
}

export default function Home() {
  const storedSession = getStoredSession();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const overlayBodyRef = useRef<HTMLDivElement | null>(null);
  const suggestedSectionRef = useRef<HTMLElement | null>(null);
  const recommendationSectionRef = useRef<HTMLElement | null>(null);
  const queuedMessagesRef = useRef<string[]>([]);
  const inactivityTimerRef = useRef<number | null>(null);
  const matchRequestVersionRef = useRef(0);
  const [showScrollNudge, setShowScrollNudge] = useState(false);
  const [showMatchNudge, setShowMatchNudge] = useState(false);
  const [showUpdatedPulse, setShowUpdatedPulse] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [shoppingPhase, setShoppingPhase] = useState<ShoppingPhase>(storedSession?.shoppingPhase ?? "mattress-discovery");
  const [cartContext, setCartContext] = useState<CartContext>(storedSession?.cartContext ?? defaultCartContext);
  const [accessoryRecommendations, setAccessoryRecommendations] = useState<AccessoryRecommendation[]>(storedSession?.accessoryRecommendations ?? []);
  const [conversationMode, setConversationMode] = useState<ConversationMode>(storedSession?.conversationMode ?? "guided-discovery");
  const [currentTheme, setCurrentTheme] = useState<string | null>(storedSession?.currentTheme ?? featuredThemes[0]?.theme ?? null);
  const [currentView, setCurrentView] = useState<DemoView>(storedSession?.currentView ?? "plp");
  const [activeProduct, setActiveProduct] = useState<ActiveProductContext | null>(storedSession?.activeProduct ?? null);
  const [activeQuestionType, setActiveQuestionType] = useState<QuestionType>(storedSession?.activeQuestionType ?? "size");
  const [lastAssistantMeta, setLastAssistantMeta] = useState<{ turnId: string; reply: string; questionText: string | null; questionType: QuestionType | null } | null>(null);
  const [easyRepliesLocked, setEasyRepliesLocked] = useState(false);
  const [currentAssistantTurnId, setCurrentAssistantTurnId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>(storedSession?.matches ?? starterMatches);
  const [splitRecommendation, setSplitRecommendation] = useState<SplitRecommendation | null>(storedSession?.splitRecommendation ?? defaultSplitRecommendation);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>(storedSession?.recommendationMode ?? "standard");
  const [messages, setMessages] = useState<ChatMessage[]>(storedSession?.messages ?? starterMessages);
  const [memorySummary, setMemorySummary] = useState(storedSession?.memorySummary ?? buildMemorySummary(starterMessages, starterMatches));
  const [showOpeningOptions, setShowOpeningOptions] = useState(false);
  const [showOtherSizes, setShowOtherSizes] = useState(false);
  const [selectedFirmnessValue, setSelectedFirmnessValue] = useState(storedSession?.selectedFirmnessValue ?? 50);
  const [selectedSize, setSelectedSize] = useState<string | null>(storedSession?.selectedSize ?? null);
  const [sizeCapturedViaPill, setSizeCapturedViaPill] = useState(storedSession?.sizeCapturedViaPill ?? false);
  const [firmnessAnswered, setFirmnessAnswered] = useState(storedSession?.firmnessAnswered ?? false);
  const [coupleSetup, setCoupleSetup] = useState<CoupleSetup>(storedSession?.coupleSetup ?? defaultCoupleSetup);
  const [shopperMemory] = useState<ShopperMemory | null>(() => {
    const now = new Date().toISOString();
    const existingId = getCookie(SHOPPER_COOKIE_KEY);

    if (existingId) {
      setCookie(SHOPPER_COOKIE_KEY, existingId, 30);
      return {
        shopperId: existingId,
        firstSeenAt: now,
        lastSeenAt: now,
        summary: storedSession?.memorySummary ?? "Returning shopper with captured preferences.",
      };
    }

    const generatedId = `demo-${Math.random().toString(36).slice(2, 10)}`;
    setCookie(SHOPPER_COOKIE_KEY, generatedId, 30);
    return {
      shopperId: generatedId,
      firstSeenAt: now,
      lastSeenAt: now,
      summary: storedSession?.memorySummary ?? "New shopper session. No durable preferences captured yet.",
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextSummary = buildMemorySummary(messages, matches);
    setMemorySummary(nextSummary);
    window.localStorage.setItem(
      SHOPPER_SESSION_KEY,
      JSON.stringify({
        shoppingPhase,
        cartContext,
        accessoryRecommendations,
        messages,
        matches,
        splitRecommendation,
        recommendationMode,
        conversationMode,
        currentTheme,
        currentView,
        activeProduct,
        activeQuestionType,
        memorySummary: nextSummary,
        selectedSize,
        selectedFirmnessValue,
        sizeCapturedViaPill,
        firmnessAnswered,
        coupleSetup,
      } satisfies PersistedSession),
    );
  }, [shoppingPhase, cartContext, accessoryRecommendations, conversationMode, currentTheme, currentView, activeProduct, activeQuestionType, matches, messages, selectedSize, selectedFirmnessValue, sizeCapturedViaPill, firmnessAnswered, splitRecommendation, recommendationMode, coupleSetup]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollChatWithPeek = () => {
    if (typeof window === "undefined") return;
    const overlay = overlayBodyRef.current;
    const bottom = chatBottomRef.current;
    if (!overlay || !bottom) return;

    const bottomRect = bottom.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const suggestedHeight = suggestedSectionRef.current?.offsetHeight ?? 0;
    const recommendationPeek = recommendationSectionRef.current ? 140 : 0;
    const reservedPeek = suggestedHeight + recommendationPeek + 24;
    const targetBottom = overlayRect.bottom - reservedPeek;

    if (bottomRect.bottom > targetBottom) {
      const delta = bottomRect.bottom - targetBottom;
      overlay.scrollTo({ top: overlay.scrollTop + delta, behavior: "smooth" });
    } else if (bottomRect.bottom < overlayRect.bottom - 120) {
      bottom.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    setShowScrollNudge(false);
    inactivityTimerRef.current = window.setTimeout(() => {
      setShowScrollNudge(true);
    }, 30_000);
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = overlayBodyRef.current;
    if (!el) return;
    const handler = () => setShowScrollNudge(false);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (messages.length === 1 && messages[0]?.id === "assistant-1") {
      const timer = window.setTimeout(() => setShowOpeningOptions(true), 420);
      return () => window.clearTimeout(timer);
    }

    setShowOpeningOptions(false);
    return undefined;
  }, [messages]);

  function lockEasyReplies() {
    setEasyRepliesLocked(true);
  }

  async function processMessage(messageText: string, options?: MessageOptions) {
    const trimmed = messageText.trim();
    const isSiteContextOnly = options?.siteContextOnly ?? false;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const transcriptForTurn = isSiteContextOnly ? messages : [...messages, userMessage];
    const nextMemorySummary = options?.overrideMemorySummary ?? buildMemorySummary(transcriptForTurn, matches);

    if (!isSiteContextOnly) {
      setMessages((current) => [...current, userMessage]);
      setDraftMessage("");
    }
    setIsLoading(true);
    lockEasyReplies();

    const runBackgroundMatch = () => {
      if (options?.skipBackgroundMatch) return;
      const requestVersion = ++matchRequestVersionRef.current;
      const intent = coupleSetup.couplePath === "split-king" && !!coupleSetup.sleeper1Firmness && !!coupleSetup.sleeper2Firmness
        ? "split"
        : "standard";

      if (coupleSetup.couplePath === "split-king") {
        setRecommendationMode("split");
        setMatches([]);
      }
      void fetchMatches({
        message: trimmed,
        memorySummary: nextMemorySummary,
        conversationTranscript: transcriptForTurn,
        recommendationIntent: intent,
        coupleSetup,
      })
        .then((matchPayload) => {
          if (requestVersion !== matchRequestVersionRef.current) return;

          if (matchPayload.mode === "split") {
            setRecommendationMode("split");
            setSplitRecommendation(matchPayload.split ?? null);
            setMatches([]);
          } else {
            const incomingMatches: MatchResult[] = matchPayload.matches ?? [];
            if (coupleSetup.couplePath === "split-king") {
              setRecommendationMode("split");
              setSplitRecommendation(null);
              setMatches([]);
              return;
            }
            setRecommendationMode("standard");
            setSplitRecommendation(null);
            setMatches(incomingMatches);
            if (incomingMatches.length > 0) {
              setCurrentTheme(incomingMatches[0]?.theme ?? null);
            }
          }

          setShowMatchNudge(true);
          setShowUpdatedPulse(true);
          window.setTimeout(() => setShowMatchNudge(false), 1500);
          window.setTimeout(() => setShowUpdatedPulse(false), 1800);
        })
        .catch(() => {
          // quietly preserve current recommendations if background matching fails
        });
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          currentTheme,
          currentView,
          activeProduct,
          shopperId: shopperMemory?.shopperId,
          conversationMode,
          memorySummary: nextMemorySummary,
          matches,
          conversationTranscript: transcriptForTurn.map(({ role, text }) => ({ role, text })),
          shoppingPhase,
          cartContext,
        }),
      });

      const payload = await response.json();
      const fullReply = payload.reply ?? "I’ve got enough to keep refining the recommendation.";
      const questionText = extractFinalQuestion(fullReply);
      const assistantTurnId = `assistant-turn-${Date.now()}`;
      setConversationMode(payload.mode ?? "guided-discovery");
      setActiveQuestionType(payload.questionType ?? null);
      setCurrentAssistantTurnId(assistantTurnId);
      setLastAssistantMeta({ turnId: assistantTurnId, reply: fullReply, questionText, questionType: payload.questionType ?? null });
      setEasyRepliesLocked(false);

      if (!options?.skipAssistantReply) {
        const assistantId = `assistant-${Date.now()}`;

        setMessages((current) => [
          ...current,
          {
            id: assistantId,
            role: "assistant",
            text: "",
          },
        ]);

        let charIndex = 0;
        const streamReply = () => {
          charIndex += Math.max(1, Math.round(fullReply.length / 55));
          const nextText = fullReply.slice(0, charIndex);

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, text: nextText }
                : message,
            ),
          );

          if (charIndex < fullReply.length) {
            window.setTimeout(streamReply, 18);
          }
        };

        streamReply();
      }

      window.setTimeout(runBackgroundMatch, options?.skipAssistantReply ? 0 : 140);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "Minor snag on the backend stub. The front-end flow is intact, but I’d retry the match request once the route settles.",
        },
      ]);
    } finally {
      setIsLoading(false);
      window.setTimeout(() => {
        inputRef.current?.focus();
        scrollChatWithPeek();
      }, 20);

      const nextQueuedMessage = queuedMessagesRef.current.shift();
      if (nextQueuedMessage) {
        window.setTimeout(() => {
          void processMessage(nextQueuedMessage);
        }, 30);
      }
    }
  }

  async function submitMessage(messageText: string, options?: MessageOptions) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    lockEasyReplies();

    if (isLoading) {
      queuedMessagesRef.current.push(trimmed);
      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: trimmed,
        },
      ]);
      setDraftMessage("");
      return;
    }

    await processMessage(trimmed, options);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sizeCapturedViaPill) {
      setFirmnessAnswered(true);
      setSelectedSize(null);
      await submitMessage(draftMessage);
      return;
    }

    if (!firmnessAnswered) {
      return;
    }

    await submitMessage(draftMessage);
  }

  const comparisonNote = getComparisonNote(matches, conversationMode, recommendationMode);
  const compareThemes = useMemo(() => matches.slice(0, 2).map(getMatchTheme).filter(Boolean) as ThemeRecord[], [matches]);
  const leadMatch = matches[0] ?? null;
  const alternativeMatches = matches.slice(1, 3);
  const compareWinner = compareThemes[0] ?? null;
  const activeThemeRecord = useMemo(() => mattressThemes.find((theme) => theme.theme === (activeProduct?.theme ?? currentTheme)) ?? null, [activeProduct, currentTheme]);
  const shouldAskShopperMode = sizeCapturedViaPill && selectedSize === "King" && !coupleSetup.shopperMode;
  const shouldAskCouplePath = selectedSize === "King" && coupleSetup.shopperMode === "two-different" && !coupleSetup.couplePath;
  const shouldAskSplitSleeper1 = coupleSetup.couplePath === "split-king" && !coupleSetup.sleeper1Firmness;
  const shouldAskSplitSleeper2 = coupleSetup.couplePath === "split-king" && !!coupleSetup.sleeper1Firmness && !coupleSetup.sleeper2Firmness;
  const isSplitKingJourney = coupleSetup.couplePath === "split-king" || shouldAskSplitSleeper1 || shouldAskSplitSleeper2;
  const shouldAskFirmness = sizeCapturedViaPill && !!selectedSize && !firmnessAnswered && !shouldAskShopperMode && !shouldAskCouplePath && !shouldAskSplitSleeper1 && !shouldAskSplitSleeper2;

  useEffect(() => {
    if (shouldAskSplitSleeper1 || shouldAskSplitSleeper2) {
      setActiveQuestionType("firmness");
      return;
    }
    if (shouldAskCouplePath) {
      setActiveQuestionType("king-path");
      return;
    }
    if (shouldAskShopperMode) {
      setActiveQuestionType("shopper-mode");
      return;
    }
    if (shouldAskFirmness) {
      setActiveQuestionType("firmness");
      return;
    }
  }, [shouldAskFirmness, shouldAskShopperMode, shouldAskCouplePath, shouldAskSplitSleeper1, shouldAskSplitSleeper2]);

  useEffect(() => {
    if (!sizeCapturedViaPill || !selectedSize) return;
    if (!messages.some((message) => message.role === "user" && /I want a .* feel\./i.test(message.text))) return;
    if (coupleSetup.couplePath === "split-king") return;
    if (!firmnessAnswered) {
      setFirmnessAnswered(true);
    }
  }, [sizeCapturedViaPill, selectedSize, coupleSetup.couplePath, firmnessAnswered, messages]);
  const isPostCartAccessoryMode = shoppingPhase === "post-cart-accessories" && !!cartContext.mattress;
  const showDynamicSections = ((recommendationMode === "standard" && matches.length > 0 && !isSplitKingJourney) || (recommendationMode === "split" && !!splitRecommendation)) && !shouldAskFirmness && !shouldAskShopperMode && !shouldAskCouplePath && !shouldAskSplitSleeper1 && !shouldAskSplitSleeper2;
  const effectiveQuestionType: QuestionType = showOpeningOptions
    ? "size"
    : shouldAskShopperMode
      ? "shopper-mode"
      : shouldAskCouplePath
        ? "king-path"
        : shouldAskSplitSleeper1 || shouldAskSplitSleeper2 || shouldAskFirmness
          ? "firmness"
          : activeQuestionType;
  const dynamicReplyPills = useMemo(() => selectEasyReplies({
    questionType: lastAssistantMeta?.questionType ?? effectiveQuestionType,
    questionText: lastAssistantMeta?.questionText ?? null,
    currentView,
    shoppingPhase,
    memorySummary,
    matches,
    conversationTranscript: messages.map(({ role, text }) => ({ role, text })),
    recommendationMode,
  }), [lastAssistantMeta, effectiveQuestionType, currentView, shoppingPhase, memorySummary, matches, messages, recommendationMode]);
  const easyRepliesReady = !isLoading
    && !easyRepliesLocked
    && !!lastAssistantMeta
    && !!currentAssistantTurnId
    && lastAssistantMeta.turnId === currentAssistantTurnId
    && dynamicReplyPills.length > 0;

  useEffect(() => {
    scrollChatWithPeek();
  }, [messages, showDynamicSections, recommendationMode]);

  const selectedFirmness = useMemo(() => {
    return firmnessStops.reduce((closest, stop) => {
      return Math.abs(stop.value - selectedFirmnessValue) < Math.abs(closest.value - selectedFirmnessValue)
        ? stop
        : closest;
    }, firmnessStops[0]);
  }, [selectedFirmnessValue]);

  async function submitFirmness() {
    if (!selectedSize) {
      await submitMessage(`I want a ${selectedFirmness.label} feel.`);
      return;
    }

    setFirmnessAnswered(true);
    const combinedMessage = `Size: ${selectedSize}. Firmness: ${selectedFirmness.label}.`;
    const syntheticTranscript = [
      ...messages,
      { id: `synthetic-size-${Date.now()}`, role: "user" as const, text: `Size: ${selectedSize}.` },
      { id: `synthetic-firmness-${Date.now()}`, role: "user" as const, text: `Firmness: ${selectedFirmness.label}.` },
    ];
    const nextSummary = buildMemorySummary(syntheticTranscript, matches);
    await submitMessage(combinedMessage, { overrideMemorySummary: nextSummary });
  }

  function openProductDetail(themeId: string, source: ActiveProductContext["source"], reason: string | null = null) {
    setCurrentTheme(themeId);
    setActiveProduct({ theme: themeId, source, reason });
    setCurrentView("pdp");

    const theme = mattressThemes.find((item) => item.theme === themeId);
    if (theme) {
      void submitMessage(`Site action: shopper opened the PDP for ${theme.displayName}.`, {
        skipBackgroundMatch: true,
        siteContextOnly: true,
      });
    }
  }

  async function handleAddMattressToCart(match: MatchResult) {
    const mattressItem: CartItem = {
      kind: "mattress",
      theme: match.theme,
      displayName: match.displayName,
      size: selectedSize,
      priceFrom: match.priceFrom,
    };

    const nextCartContext: CartContext = {
      mattress: mattressItem,
      accessories: [],
    };

    setCartContext(nextCartContext);
    setShoppingPhase("post-cart-accessories");
    setCurrentView("cart");
    setActiveProduct({ theme: match.theme, source: "recommendation", reason: "Added from recommendation flow" });

    const setupType = coupleSetup.couplePath === "split-king" ? "split-king" : "standard";

    try {
      const payload = await fetchAccessories({
        cartMattress: mattressItem,
        memorySummary,
        conversationTranscript: messages,
        setupType,
      });
      setAccessoryRecommendations(payload.recommendations ?? []);
    } catch {
      setAccessoryRecommendations([]);
    }

    await submitMessage(
      `Site action: shopper added ${match.displayName} to cart. Help complete the sleep setup.`,
      { skipBackgroundMatch: true, siteContextOnly: true },
    );
  }

  function handleAddAccessoryToCart(recommendation: AccessoryRecommendation) {
    const primary = recommendation.primary;
    if (!primary) return;

    setCartContext((current) => ({
      ...current,
      accessories: [
        ...current.accessories,
        {
          kind: recommendation.category,
          theme: primary.theme,
          displayName: primary.displayName,
          priceFrom: primary.priceFrom,
        },
      ],
    }));
  }

  function resetConversationState() {
    setShoppingPhase("mattress-discovery");
    setCartContext(defaultCartContext);
    setAccessoryRecommendations([]);
    setMessages(starterMessages);
    setMatches(starterMatches);
    setSplitRecommendation(defaultSplitRecommendation);
    setRecommendationMode("standard");
    setConversationMode("guided-discovery");
    setCurrentView("plp");
    setActiveProduct(null);
    setActiveQuestionType("size");
    setCurrentTheme(featuredThemes[0]?.theme ?? null);
    setDraftMessage("");
    setShowOpeningOptions(false);
    setSelectedSize(null);
    setSizeCapturedViaPill(false);
    setFirmnessAnswered(false);
    setCoupleSetup(defaultCoupleSetup);
    window.setTimeout(() => {
      setShowOpeningOptions(true);
      inputRef.current?.focus();
    }, 420);
  }

  return (
    <div className={styles.page}>
      <main className={styles.viewport}>
        <section className={`${styles.siteSurface} ${isOpen ? styles.siteSurfaceShifted : ""}`}>
          <header className={styles.mainHeader}>
            <div className={styles.headerRow}>
              <button type="button" className={styles.iconButton}>☰</button>
              <div className={styles.logoWrap}>
                <Image src="/assets/rooms-to-go-logo-2.png" alt="Rooms To Go" width={190} height={40} className={styles.headerBrandImage} />
              </div>
              <div className={styles.searchWrap}>
                <input value="Find your furniture" readOnly aria-label="Search" />
                <button type="button">⌕</button>
              </div>
              <div className={styles.headerIcons}>
                <span>♡</span>
                <span>🛒</span>
              </div>
            </div>
            <nav className={styles.desktopNav}>
              {[
                "LIVING ROOMS",
                "BEDROOMS",
                "DINING ROOMS",
                "MATTRESSES",
                "PATIO",
                "KIDS & TEENS",
                "RUGS & DECOR",
                "SALES",
                "FINANCING",
              ].map((item) => (
                <span key={item} className={item === "SALES" ? styles.salesNav : item === "MATTRESSES" ? styles.activeNav : ""}>
                  {item}
                </span>
              ))}
            </nav>
          </header>

          <section className={styles.generatedPage}>
            <div className={styles.breadcrumbs}>
              <span>Home</span>
              <span>›</span>
              <span>Mattresses</span>
            </div>

            <div className={styles.pillTabsWrap}>
              <div className={styles.pillTabs}>
                <button type="button" className={styles.pillActive}>Discover</button>
                <button type="button">On Sale</button>
              </div>
            </div>

            <div className={styles.heroAsset}>
              <Image src="https://assets.roomstogo.com/v2/MT_CatPg_Hero_KB_Desktop_1660w-2026-04-06T16_35_20.847Z.png?q=70" alt="Rooms To Go mattress hero" fill unoptimized className={styles.coverImage} />
            </div>

            <section className={styles.sizeRail}>
              {sizeIcons.map(([label, src]) => (
                <div key={label} className={styles.sizeTile}>
                  <div className={styles.sizeIconWrap}>
                    <Image src={src} alt={label} width={40} height={40} unoptimized />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            <section className={styles.brandStrip}>
              {brandLogos.map((src, index) => (
                <div key={src} className={styles.brandLogoCard}>
                  <Image src={src} alt={`Mattress brand ${index + 1}`} width={140} height={48} unoptimized className={styles.brandLogo} />
                </div>
              ))}
            </section>

            <section className={styles.contentBannerGrid}>
              <div className={styles.largeBanner}>
                <Image src="https://assets.roomstogo.com/v2/MT_CatPg_Types_Banner_KB_1660w_01_Compare.png?q=70" alt="Compare mattress types" fill unoptimized className={styles.coverImage} />
              </div>
              <div className={styles.bannerStack}>
                <div className={styles.smallBanner}>
                  <Image src="https://assets.roomstogo.com/v2/MT_CatPg_Features_Banner_KB_1660w_02_Temp.png?q=70" alt="Cooling mattresses" fill unoptimized className={styles.coverImage} />
                </div>
                <div className={styles.smallBanner}>
                  <Image src="https://assets.roomstogo.com/v2/MT_CatPg_Features_Banner_KB_1660w_03_Pressure.png?q=70" alt="Pressure relief mattresses" fill unoptimized className={styles.coverImage} />
                </div>
              </div>
            </section>

            {currentView === "pdp" && activeThemeRecord ? (
              <section className={styles.mockPdpSection}>
                <div className={styles.mockPdpHeaderRow}>
                  <button type="button" className={styles.pdpBackButton} onClick={() => setCurrentView("plp")}>← Back to results</button>
                  <button type="button" className={styles.pdpCartButton} onClick={() => setCurrentView("cart")}>View Cart</button>
                </div>
                <div className={styles.mockPdpGrid}>
                  <div className={styles.mockPdpGallery}>
                    {activeThemeRecord.heroImage ? (
                      <Image src={activeThemeRecord.heroImage} alt={activeThemeRecord.displayName} fill unoptimized className={styles.productTileImage} />
                    ) : (
                      <div className={styles.productImagePlaceholder}><span>{activeThemeRecord.brand}</span></div>
                    )}
                  </div>
                  <div className={styles.mockPdpSummary}>
                    <p className={styles.mockPdpBrand}>{activeThemeRecord.brand}</p>
                    <h2>{activeThemeRecord.displayName}</h2>
                    <div className={styles.tagRow}>
                      <span>{activeThemeRecord.type || "Type TBD"}</span>
                      <span>{activeThemeRecord.comfort || "Comfort TBD"}</span>
                    </div>
                    <strong className={styles.mockPdpPrice}>
                      {activeThemeRecord.priceRange?.min ? `From $${activeThemeRecord.priceRange.min.toLocaleString()}` : "Price TBD"}
                    </strong>
                    <p className={styles.mockPdpReason}>
                      {activeProduct?.reason ?? "Shop Pilot is carrying your recommendation context directly into this PDP."}
                    </p>
                    <div className={styles.mockPdpFeatureList}>
                      <div><span>Cooling</span><b>{activeThemeRecord.temperatureManagement?.label ?? "Balanced"}</b></div>
                      <div><span>Support</span><b>{activeThemeRecord.supportLevel?.label ?? "Supportive"}</b></div>
                      <div><span>Pressure relief</span><b>{activeThemeRecord.pressureRelief?.label ?? "Responsive"}</b></div>
                    </div>
                    <div className={styles.mockPdpActions}>
                      <button
                        type="button"
                        className={styles.addToCartButton}
                        onClick={() => handleAddMattressToCart({
                          theme: activeThemeRecord.theme,
                          displayName: activeThemeRecord.displayName,
                          brand: activeThemeRecord.brand,
                          type: activeThemeRecord.type,
                          comfort: activeThemeRecord.comfort,
                          priceFrom: activeThemeRecord.priceRange?.min ?? null,
                          score: 0,
                        })}
                      >
                        Add to cart
                      </button>
                      <button type="button" className={styles.pdpSecondaryButton} onClick={() => setCurrentView("plp")}>Back to compare</button>
                    </div>
                  </div>
                </div>
              </section>
            ) : currentView === "cart" ? (
              <section className={styles.mockCartSection}>
                <div className={styles.mockPdpHeaderRow}>
                  <button type="button" className={styles.pdpBackButton} onClick={() => setCurrentView(cartContext.mattress ? "pdp" : "plp")}>← Continue shopping</button>
                </div>
                <div className={styles.mockCartShell}>
                  <div className={styles.mockCartItems}>
                    <h2>Mock Cart</h2>
                    {cartContext.mattress ? (
                      <article className={styles.mockCartItem}>
                        <div>
                          <p>Mattress</p>
                          <h3>{cartContext.mattress.displayName}</h3>
                          <span>{cartContext.mattress.size ?? selectedSize ?? "Size not selected"}</span>
                        </div>
                        <strong>{cartContext.mattress.priceFrom ? `From $${cartContext.mattress.priceFrom.toLocaleString()}` : "Price TBD"}</strong>
                      </article>
                    ) : (
                      <div className={styles.mockCartEmpty}>No mattress in cart yet.</div>
                    )}
                    {cartContext.accessories.map((item) => (
                      <article key={`${item.kind}-${item.theme}`} className={styles.mockCartItem}>
                        <div>
                          <p>{item.kind.replace(/-/g, " ")}</p>
                          <h3>{item.displayName}</h3>
                        </div>
                        <strong>{item.priceFrom ? `From $${item.priceFrom.toLocaleString()}` : "Included"}</strong>
                      </article>
                    ))}
                  </div>
                  <div className={styles.mockCartSummaryBox}>
                    <h3>Summary</h3>
                    <p>Shop Pilot stays aware of what’s already in the cart and shifts into completion mode.</p>
                    <button type="button" className={styles.addToCartButton} onClick={() => setIsOpen(true)}>Ask Shop Pilot for next best add-ons</button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <div className={styles.resultsMeta}>
                  <strong>Shop Mattresses</strong>
                  <span>Scrape-derived shell with RTG-category visuals and structure</span>
                </div>

                <div className={styles.productGrid}>
                  {featuredThemes.map((theme) => (
                    <article
                      key={theme.theme}
                      className={`${styles.productTile} ${currentTheme === theme.theme ? styles.productTileActive : ""}`}
                      onClick={() => openProductDetail(theme.theme, "featured", "Opened from the category browsing experience.")}
                    >
                      <div className={styles.productTileImageWrap}>
                        {theme.heroImage ? (
                          <Image src={theme.heroImage} alt={theme.displayName} fill unoptimized className={styles.productTileImage} />
                        ) : (
                          <div className={styles.productImagePlaceholder}><span>{theme.brand}</span></div>
                        )}
                      </div>
                      <div className={styles.productTileBody}>
                        <p>{theme.brand}</p>
                        <h3>{theme.displayName}</h3>
                        <div className={styles.tagRow}>
                          <span>{theme.type || "Type TBD"}</span>
                          <span>{theme.comfort || "Comfort TBD"}</span>
                        </div>
                        <strong>
                          {theme.priceRange?.min
                            ? `From $${theme.priceRange.min.toLocaleString()}`
                            : "Price TBD"}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </section>

        <aside className={`${styles.overlayPanel} ${isOpen ? styles.open : styles.closed}`}>
          <button
            type="button"
            className={styles.edgeTab}
            onClick={() => setIsOpen((value) => !value)}
            aria-label={isOpen ? "Collapse Shop Pilot" : "Open Shop Pilot"}
          >
            <span className={styles.edgeCaret}>{isOpen ? ">" : "<"}</span>
            <span className={styles.edgeLabel}>Virtual<br />Assistance</span>
          </button>

          <div className={styles.overlayBody} ref={overlayBodyRef}>
            <div className={styles.panelBrandBar}>
              <div className={styles.panelBrandCluster}>
                <Image src="/assets/RoomsToGoVMM.png" alt="Rooms To Go" width={260} height={64} className={styles.panelPartnerImage} />
              </div>
              <div className={styles.panelActions}>
                <button
                  type="button"
                  className={styles.panelIconButton}
                  onClick={() => setShoppingPhase("post-cart-accessories")}
                  aria-label="View cart"
                  title="View cart"
                >
                  <span className={styles.panelCartIcon}>🛒</span>
                </button>
                <button
                  type="button"
                  className={styles.panelIconButton}
                  onClick={resetConversationState}
                  aria-label="Restart chat"
                  title="Restart chat"
                >
                  ↻
                </button>
              </div>
            </div>

            <section className={styles.chatSurface}>
              {isPostCartAccessoryMode ? (
                <div className={styles.postCartShell}>
                  <section className={styles.postCartIntro}>
                    <span className={styles.postCartLabel}>Accessory Mode</span>
                    <h3>Complete your sleep setup</h3>
                    <p>Your mattress is locked in. Now we can focus entirely on the best add-ons.</p>
                  </section>

                  <section className={styles.postCartSummaryCard}>
                    <span className={styles.postCartSummaryLabel}>In Cart</span>
                    <strong>{cartContext.mattress?.displayName}</strong>
                    <p>{cartContext.mattress?.size ?? selectedSize ?? "Size not selected"}</p>
                    {cartContext.mattress?.priceFrom ? <b>{`From $${cartContext.mattress.priceFrom.toLocaleString()}`}</b> : null}
                  </section>

                  <section className={styles.suggestedSection}>
                    <span className={styles.suggestedLabel}>Easy Reply</span>
                    <div className={styles.chipsSection}>
                      {[
                        { label: "Add a pillow", message: "Show me the best pillow recommendation." },
                        { label: "Add a protector", message: "Show me the best mattress protector." },
                        { label: "Show adjustable base", message: "Show me the best adjustable base." },
                        { label: "I’m done", message: "I am done with accessories." },
                      ].map((pill) => (
                        <button key={pill.label} type="button" onClick={() => submitMessage(pill.message)}>{pill.label}</button>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <>
                  <div className={styles.messageList}>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={message.role === "assistant" ? styles.messageAssistantRow : styles.messageUserRow}
                      >
                        {message.role === "assistant" ? (
                          <Image
                            src="/assets/rtg-chat-logo.png"
                            alt="Shop Pilot avatar"
                            width={40}
                            height={40}
                            className={styles.chatAvatar}
                          />
                        ) : null}
                        <div className={message.role === "assistant" ? styles.messageAssistant : styles.messageUser}>
                          <p>{renderMessageText(message.text)}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading ? (
                      <div className={`${styles.messageAssistant} ${styles.messageThinking}`}>
                        <p>Considering…</p>
                      </div>
                    ) : null}
                    <div ref={chatBottomRef} />
                  </div>

                  {showOpeningOptions ? (
                    <section className={styles.openingOptions}>
                      {startingSizeOptions.map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          className={`${styles.openingChip}${showOtherSizes && option === "Other" ? ` ${styles.openingChipActive}` : ""}`}
                          style={{ animationDelay: `${index * 60}ms` }}
                          onClick={() => {
                            if (option === "Other") {
                              setShowOtherSizes((v) => !v);
                            } else {
                              const isNotSure = option === "Not Sure";
                              setSelectedSize(option);
                              setSizeCapturedViaPill(!isNotSure);
                              setFirmnessAnswered(false);
                              setCoupleSetup(defaultCoupleSetup);
                              setRecommendationMode("standard");
                              setSplitRecommendation(null);
                              setMatches([]);
                              setShowOpeningOptions(false);
                              if (isNotSure) {
                                void submitMessage(option);
                              }
                            }
                          }}
                        >
                          {option}
                        </button>
                      ))}
                      {showOtherSizes ? (
                        <div className={styles.otherSizesRow}>
                          {otherSizeOptions.map((size, index) => (
                            <button
                              key={size}
                              type="button"
                              className={styles.openingChip}
                              style={{ animationDelay: `${index * 50}ms` }}
                              onClick={() => {
                                setSelectedSize(size);
                                setSizeCapturedViaPill(true);
                                setFirmnessAnswered(false);
                                setCoupleSetup(defaultCoupleSetup);
                                setRecommendationMode("standard");
                                setSplitRecommendation(null);
                                setMatches([]);
                                setShowOpeningOptions(false);
                              }}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {shouldAskShopperMode ? (
                    <section className={styles.openingOptions}>
                      <div className={styles.firmnessPromptHeader}>
                        <span>Next up</span>
                        <strong>Who are we shopping for?</strong>
                      </div>
                      <div className={styles.otherSizesRow}>
                        {shopperModeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={styles.openingChip}
                            onClick={() => {
                              setCoupleSetup((current) => ({
                                ...current,
                                shopperMode: option.value,
                                couplePath: option.value === "two-different" ? null : null,
                                sleeper1Firmness: null,
                                sleeper2Firmness: null,
                              }));
                              if (option.value !== "two-different") {
                                setRecommendationMode("standard");
                                setSplitRecommendation(null);
                              }
                              void submitMessage(option.value === "two-different" ? "Two sleepers with different preferences." : option.value === "two-similar" ? "Two sleepers." : "Just me.");
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {shouldAskCouplePath ? (
                    <section className={styles.openingOptions}>
                      <div className={styles.firmnessPromptHeader}>
                        <span>Couples setup</span>
                        <strong>How would you like to shop this king setup?</strong>
                      </div>
                      <div className={styles.otherSizesRow}>
                        {couplePathOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={styles.openingChip}
                            onClick={() => {
                              setCoupleSetup((current) => ({
                                ...current,
                                couplePath: option.value,
                                sleeper1Firmness: null,
                                sleeper2Firmness: null,
                              }));
                              if (option.value === "compromise") {
                                setRecommendationMode("standard");
                                setSplitRecommendation(null);
                                void submitMessage("We want one mattress that works for both of us.");
                                return;
                              }
                              void submitMessage("We want to explore a split king / Twin XL setup.");
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {shouldAskSplitSleeper1 ? (
                    <section className={styles.openingOptions}>
                      <div className={styles.firmnessPromptHeader}>
                        <span>Split king setup</span>
                        <strong>What firmness does sleeper 1 prefer?</strong>
                      </div>
                      <div className={styles.otherSizesRow}>
                        {splitFirmnessOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={styles.openingChip}
                            onClick={() => {
                              setCoupleSetup((current) => ({ ...current, sleeper1Firmness: option }));
                              void submitMessage(`Two sleepers with different preferences. Split king. Sleeper 1 wants ${option}.`);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {shouldAskSplitSleeper2 ? (
                    <section className={styles.openingOptions}>
                      <div className={styles.firmnessPromptHeader}>
                        <span>Split king setup</span>
                        <strong>What firmness does sleeper 2 prefer?</strong>
                      </div>
                      <div className={styles.otherSizesRow}>
                        {splitFirmnessOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={styles.openingChip}
                            onClick={() => {
                              const nextSetup = { ...coupleSetup, sleeper2Firmness: option };
                              setCoupleSetup(nextSetup);
                              setFirmnessAnswered(true);
                              void submitMessage(`Two sleepers with different preferences. Split king. Sleeper 1 wants ${nextSetup.sleeper1Firmness}. Sleeper 2 wants ${option}.`);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {shouldAskFirmness ? (
                    <section className={styles.firmnessPrompt}>
                      <div className={styles.firmnessPromptHeader}>
                        <span>{selectedSize ? `${selectedSize} selected` : "Next up"}</span>
                        <strong>What firmness feels best to you?</strong>
                      </div>
                      <div className={styles.firmnessSliderWrap}>
                        <div className={styles.firmnessScaleLabels}>
                          <span>Plush</span>
                          <span>Firm</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={selectedFirmnessValue}
                          onChange={(event) => setSelectedFirmnessValue(Number(event.target.value))}
                          className={styles.firmnessSlider}
                          aria-label="Firmness preference"
                        />
                        <div className={styles.firmnessSelected}>{selectedFirmness.label}</div>
                        <button type="button" className={styles.firmnessSubmit} onClick={submitFirmness}>
                          Use {selectedFirmness.label}
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {shouldAskFirmness ? (
                    <section className={styles.firmnessAltOption}>
                      <button
                        type="button"
                        className={styles.openingChip}
                        onClick={() => {
                          setFirmnessAnswered(true);
                          void submitMessage(selectedSize ? `${selectedSize}. It’s complicated.` : "It’s complicated");
                        }}
                      >
                        Its complicated
                      </button>
                    </section>
                  ) : null}

                  <form className={styles.composer} onSubmit={handleSubmit} onMouseDown={resetInactivityTimer}>
                    <input
                      ref={inputRef}
                      value={draftMessage}
                      onChange={(event) => { setDraftMessage(event.target.value); resetInactivityTimer(); }}
                      placeholder="What matters most to you?"
                      aria-label="Message Shop Pilot"
                    />
                    <button type="submit" className={styles.sendBtn} disabled={isLoading} aria-label="Send">
                      {isLoading ? <span className={styles.sendDots}>…</span> : <span className={styles.sendArrow}>↑</span>}
                    </button>
                  </form>
                </>
              )}
            </section>

            {showDynamicSections ? (
              <>
                {!isPostCartAccessoryMode && recommendationMode !== "split" && easyRepliesReady ? (
                  <section className={styles.suggestedSection} ref={suggestedSectionRef}>
                    <span className={styles.suggestedLabel}>Easy Reply</span>
                    <div className={styles.chipsSection}>
                      {dynamicReplyPills.map((pill) => (
                        <button key={pill.label} type="button" disabled={isLoading || easyRepliesLocked} onClick={() => submitMessage(pill.message)}>{pill.label}</button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {recommendationMode === "split" && splitRecommendation ? (
                  <section ref={recommendationSectionRef} className={`${styles.recommendationSection} ${showUpdatedPulse ? styles.recommendationSectionPulse : ""}`}>
                    <div className={styles.sectionHeader}>
                      <h3 className={styles.recommendationHeading}>Current Recommendations</h3>
                      <p>Individual Twin XL fits for each sleeper, with one shared setup</p>
                    </div>
                    <div className={styles.splitSummaryBanner}>
                      <strong>Shared strategy</strong>
                      <p>{splitRecommendation.explanation}</p>
                    </div>
                    <div className={styles.splitGrid}>
                      {[splitRecommendation.sleeper1, splitRecommendation.sleeper2].map((match, index) => {
                        if (!match) return null;
                        const theme = getMatchTheme(match);
                        const coolingScore = getFeatureScore(theme?.temperatureManagement?.label);
                        const supportScore = getFeatureScore(theme?.supportLevel?.label);
                        const pressureScore = getFeatureScore(theme?.pressureRelief?.label);
                        return (
                          <article key={`${match.theme}-${index}`} className={styles.candidateCard}>
                            <div className={styles.candidateImageWrap}>
                              {theme?.heroImage ? (
                                <Image src={theme.heroImage} alt={match.displayName} fill unoptimized className={styles.candidateImage} />
                              ) : null}
                            </div>
                            <div className={styles.candidateCardBody}>
                              <div className={styles.candidateTopRow}>
                                <p>{index === 0 ? "Sleeper 1" : "Sleeper 2"}</p>
                                <span className={styles.bestFitPill}>Twin XL</span>
                              </div>
                              <h4>{match.displayName}</h4>
                              {match.type || match.comfort ? (
                                <span>{[match.type, match.comfort].filter(Boolean).join(" · ")}</span>
                              ) : null}
                              {match.priceFrom ? <strong>{`From $${match.priceFrom.toLocaleString()}`}</strong> : null}
                              <div className={styles.miniMetrics}>
                                {coolingScore ? <div><span>Cooling</span><b>{coolingScore}</b></div> : null}
                                {supportScore ? <div><span>Support</span><b>{supportScore}</b></div> : null}
                                {pressureScore ? <div><span>Relief</span><b>{pressureScore}</b></div> : null}
                              </div>
                              <div className={styles.reasonList}>
                                {getFitReasons(match, memorySummary).map((reason) => (
                                  <em key={reason}>{reason}</em>
                                ))}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <div className={styles.splitReasonList}>
                      {buildSplitReasonList(splitRecommendation).map((line) => (
                        <em key={line}>{line}</em>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section ref={recommendationSectionRef} className={`${styles.recommendationSection} ${showUpdatedPulse ? styles.recommendationSectionPulse : ""}`}>

                    {leadMatch ? (() => {
                      const theme = getMatchTheme(leadMatch);
                      const coolingScore = getFeatureScore(theme?.temperatureManagement?.label);
                      const supportScore = getFeatureScore(theme?.supportLevel?.label);
                      const pressureScore = getFeatureScore(theme?.pressureRelief?.label);
                      return (
                        <article className={`${styles.candidateCard} ${styles.candidateCardLead}`}>
                          <div className={styles.candidateImageWrap}>
                            {theme?.heroImage ? (
                              <Image src={theme.heroImage} alt={leadMatch.displayName} fill unoptimized className={styles.candidateImage} />
                            ) : null}
                            <span className={styles.candidateHeroBadge}>Current Match</span>
                          </div>
                          <div className={styles.candidateCardBody}>
                            <div className={styles.candidateTopRow}>
                              <p>{leadMatch.brand}</p>
                              <span className={styles.bestFitPill}>{getRecommendationTierLabel(0)}</span>
                            </div>
                            <div className={styles.recommendationHeroHeader}>
                              <div>
                                <h4>{leadMatch.displayName}</h4>
                                <span className={styles.recommendationSubcopy}>{getRecommendationTierSubcopy(0)}</span>
                              </div>
                              {leadMatch.priceFrom ? <strong>{`From $${leadMatch.priceFrom.toLocaleString()}`}</strong> : null}
                            </div>
                            {leadMatch.type || leadMatch.comfort ? (
                              <span>{[leadMatch.type, leadMatch.comfort].filter(Boolean).join(" · ")}</span>
                            ) : null}
                            <div className={styles.recommendationWhyBlock}>
                              <span>Why this is the fit</span>
                              <p>{buildRecommendationWhy(leadMatch, memorySummary, 0)}</p>
                            </div>
                            <div className={styles.miniMetrics}>
                              {coolingScore ? <div><span>Cooling</span><b>{coolingScore}</b></div> : null}
                              {supportScore ? <div><span>Support</span><b>{supportScore}</b></div> : null}
                              {pressureScore ? <div><span>Relief</span><b>{pressureScore}</b></div> : null}
                            </div>
                            <div className={styles.reasonList}>
                              {getFitReasons(leadMatch, memorySummary).map((reason) => (
                                <em key={reason}>{reason}</em>
                              ))}
                            </div>
                            <div className={`${styles.recommendationCardActions} ${styles.recommendationCardActionsLead}`}>
                              <button type="button" className={styles.addToCartButton} onClick={() => handleAddMattressToCart(leadMatch)}>
                                Add to Cart
                              </button>
                              <button
                                type="button"
                                aria-label={`View ${leadMatch.displayName} details`}
                                title="View PDP"
                                className={styles.pdpIconButton}
                                onClick={() => openProductDetail(leadMatch.theme, "recommendation", `Shop Pilot recommended this because it aligns with the shopper's current priorities.`)}
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })() : null}

                    {alternativeMatches.length ? (
                      <div className={styles.alternativeSection}>
                        <div className={styles.alternativeSectionHeader}>
                          <h4>Other options</h4>
                          <p>Currently, these are your 2nd and 3rd ranked matches.</p>
                        </div>
                        <div className={styles.candidateScroller}>
                          <div className={styles.candidateList}>
                            {alternativeMatches.map((match, index) => {
                              const tierIndex = index + 1;
                              const theme = getMatchTheme(match);
                              const coolingScore = getFeatureScore(theme?.temperatureManagement?.label);
                              const supportScore = getFeatureScore(theme?.supportLevel?.label);
                              const pressureScore = getFeatureScore(theme?.pressureRelief?.label);

                              return (
                                <article key={match.theme} className={`${styles.candidateCard} ${styles.candidateCardAlternative}`}>
                                  <div className={styles.candidateImageWrap}>
                                    {theme?.heroImage ? (
                                      <Image src={theme.heroImage} alt={match.displayName} fill unoptimized className={styles.candidateImage} />
                                    ) : null}
                                  </div>
                                  <div className={styles.candidateCardBody}>
                                    <div className={styles.candidateTopRow}>
                                      <p>{match.brand}</p>
                                      <span className={styles.alternativePill}>{getRecommendationTierLabel(tierIndex)}</span>
                                    </div>
                                    <div className={styles.recommendationHeroHeader}>
                                      <div>
                                        <h4>{match.displayName}</h4>
                                        <span className={styles.recommendationSubcopy}>{getRecommendationTierSubcopy(tierIndex)}</span>
                                      </div>
                                      {match.priceFrom ? <strong>{`From $${match.priceFrom.toLocaleString()}`}</strong> : null}
                                    </div>
                                    {match.type || match.comfort ? (
                                      <span>{[match.type, match.comfort].filter(Boolean).join(" · ")}</span>
                                    ) : null}
                                    <div className={styles.recommendationWhyBlock}>
                                      <span>Why someone would pick this</span>
                                      <p>{buildRecommendationWhy(match, memorySummary, tierIndex)}</p>
                                    </div>
                                    <div className={styles.miniMetrics}>
                                      {coolingScore ? <div><span>Cooling</span><b>{coolingScore}</b></div> : null}
                                      {supportScore ? <div><span>Support</span><b>{supportScore}</b></div> : null}
                                      {pressureScore ? <div><span>Relief</span><b>{pressureScore}</b></div> : null}
                                    </div>
                                    <div className={styles.reasonList}>
                                      {getFitReasons(match, memorySummary).map((reason) => (
                                        <em key={reason}>{reason}</em>
                                      ))}
                                    </div>
                                    <div className={styles.recommendationCardActions}>
                                      <button type="button" className={styles.addToCartButton} onClick={() => handleAddMattressToCart(match)}>
                                        Add to Cart
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`View ${match.displayName} details`}
                                        title="View PDP"
                                        className={styles.pdpIconButton}
                                        onClick={() => openProductDetail(match.theme, "recommendation", `Shop Pilot recommended this because it aligns with the shopper's current priorities.`)}
                                      >
                                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                          <circle cx="12" cy="12" r="3" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                )}

                {isPostCartAccessoryMode ? (
                  <section className={styles.recommendationSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Complete your sleep setup</h3>
                      <p>{cartContext.mattress?.displayName} is already in the cart. These are the best next adds.</p>
                    </div>
                    <div className={styles.splitSummaryBanner}>
                      <strong>In cart</strong>
                      <p>{cartContext.mattress?.displayName}</p>
                    </div>
                    <div className={styles.accessoryGrid}>
                      {accessoryRecommendations.map((recommendation) => (
                        <article key={recommendation.category} className={styles.accessoryCard}>
                          <div className={styles.candidateTopRow}>
                            <p>{recommendation.category.replace(/-/g, " ")}</p>
                            <span className={styles.bestFitPill}>Recommended</span>
                          </div>
                          <h4>{recommendation.primary?.displayName ?? "No recommendation yet"}</h4>
                          {recommendation.primary?.brand ? <span>{recommendation.primary.brand}</span> : null}
                          {recommendation.primary?.priceFrom ? <strong>{`From $${recommendation.primary.priceFrom.toLocaleString()}`}</strong> : null}
                          {recommendation.explanation ? <div className={styles.reasonList}><em>{recommendation.explanation}</em></div> : null}
                          {recommendation.primary ? (
                            <button type="button" className={styles.addToCartButton} onClick={() => handleAddAccessoryToCart(recommendation)}>
                              Add to cart
                            </button>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {recommendationMode === "standard" && compareThemes.length >= 2 ? (
                  <section className={styles.compareSection}>
                    <div className={styles.sectionHeader}>
                      <h3 className={styles.recommendationHeading}>Compare</h3>
                      <p>Your top two recommendations side by side</p>
                    </div>
                    <div className={styles.compareScroller}>
                      <div className={styles.compareGrid}>
                        {compareThemes.map((theme, index) => (
                          <article key={theme.theme} className={`${styles.compareCard} ${index === 0 ? styles.compareCardLead : ""}`}>
                            <div className={styles.compareImageWrap}>
                              {theme.heroImage ? (
                                <Image src={theme.heroImage} alt={theme.displayName} fill unoptimized className={styles.compareImage} />
                              ) : null}
                              {index === 0 ? <span className={styles.compareWinnerPill}>Top fit</span> : null}
                            </div>
                            <div className={styles.compareCardBody}>
                              <p>{theme.brand}</p>
                              <h4>{theme.displayName}</h4>
                              {theme.priceRange?.min ? <strong>{`From $${theme.priceRange.min.toLocaleString()}`}</strong> : null}
                              <div className={styles.compareStats}>
                                {theme.comfort ? <div><span>Feel</span><b>{theme.comfort}</b></div> : null}
                                {theme.type ? <div><span>Type</span><b>{theme.type}</b></div> : null}
                                {theme.temperatureManagement?.label ? <div><span>Cooling</span><b>{theme.temperatureManagement.label}</b></div> : null}
                                {theme.supportLevel?.label ? <div><span>Support</span><b>{theme.supportLevel.label}</b></div> : null}
                              </div>
                              <div className={styles.compareCallouts}>
                                <em>{getBestFor(theme)}</em>
                                {theme.pressureRelief?.label ? <em>Pressure relief: {theme.pressureRelief.label}</em> : null}
                              </div>
                              {compareWinner?.theme === theme.theme ? (
                                <div className={styles.compareWinnerNote}>Best current fit based on the shopper’s stated priorities.</div>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>

          {(showScrollNudge || showMatchNudge) && showDynamicSections ? (
            <button
              type="button"
              className={styles.scrollNudge}
              onClick={() => {
                setShowScrollNudge(false);
                setShowMatchNudge(false);
                resetInactivityTimer();
                document.querySelector(`.${styles.candidateScroller}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className={styles.scrollNudgeLabel}>View recommendations</span>
              <span className={styles.scrollNudgeArrows}>
                <span>↓</span>
                <span>↓</span>
                <span>↓</span>
              </span>
            </button>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
