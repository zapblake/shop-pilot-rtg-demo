"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import mattressThemes from "@/data/mattressThemes.normalized.json";
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

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type MessageOptions = {
  skipAssistantReply?: boolean;
  overrideMemorySummary?: string;
  skipBackgroundMatch?: boolean;
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

type PersistedSession = {
  messages: ChatMessage[];
  matches: MatchResult[];
  conversationMode: ConversationMode;
  currentTheme: string | null;
  memorySummary: string;
  selectedSize: string | null;
  sizeCapturedViaPill: boolean;
  firmnessAnswered: boolean;
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
const startingSizeOptions = ["Queen", "King", "Not Sure", "Other"];
const otherSizeOptions = ["California King", "Full", "Twin", "Twin XL", "RV King", "Short Queen"];
const firmnessStops = [
  { value: 0, label: "Plush" },
  { value: 25, label: "Medium-plush" },
  { value: 50, label: "Medium" },
  { value: 75, label: "Medium-firm" },
  { value: 100, label: "Firm" },
];

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
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function buildMemorySummary(messages: ChatMessage[], matches: MatchResult[]) {
  const userText = messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.text)
    .join(" ")
    .toLowerCase();

  const preferences = [
    userText.includes("side") ? "side-sleeper" : null,
    userText.includes("back") ? "back-sleeper" : null,
    userText.includes("hot") || userText.includes("cool") ? "cooling-conscious" : null,
    userText.includes("queen") ? "queen-size shopper" : null,
    userText.includes("king") ? "king-size shopper" : null,
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
  if (lowerSummary.includes("pressure") && descriptor.match(/foam|plush|medium/)) {
    reasons.push("Pressure-relief friendly");
  }
  if (lowerSummary.includes("budget") || lowerSummary.includes("under") || lowerSummary.includes("$") || lowerSummary.includes("budget-aware")) {
    if ((match.priceFrom ?? 999999) < 2000) reasons.push("Budget aligned");
  }
  if (!reasons.length) reasons.push("Strong overall match");

  return reasons.slice(0, 3);
}

function getDynamicReplyPills(messages: ChatMessage[], summary: string, matches: MatchResult[]) {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text)
    .join(" ")
    .toLowerCase();

  const wantsSoft = /soft|plush/.test(userText);
  const knowsPosition = /side|back|stomach/.test(userText);
  const knowsCooling = /hot|cool|cooling/.test(userText);
  const knowsWeight = /\b(under 180|180|230|over 230|heavy|heavier|light|medium weight|300lb|300 lbs|250lb|250 lbs)\b/.test(userText);
  const knowsPain = /back pain|lower back|shoulder pain|hip pain|pressure/.test(userText);
  const inComparison = matches.length > 1;

  if (!knowsPosition) {
    return [
      { label: "Side sleeper", message: "I’m a side sleeper." },
      { label: "Back sleeper", message: "I’m a back sleeper." },
      { label: "Stomach sleeper", message: "I’m a stomach sleeper." },
    ];
  }

  if (wantsSoft && !knowsWeight) {
    return [
      { label: "Under 180 lbs", message: "I want a plush feel and I’m under 180 lbs." },
      { label: "180–230 lbs", message: "I want a plush feel and I’m between 180 and 230 lbs." },
      { label: "Over 230 lbs", message: "I want a plush feel and I’m over 230 lbs." },
    ];
  }

  if (!knowsCooling) {
    return [
      { label: "I sleep hot", message: "I sleep hot at night." },
      { label: "Cooling matters", message: "Cooling matters most to me." },
      { label: "Temp not important", message: "Temperature does not matter much to me." },
    ];
  }

  if (!knowsPain) {
    return [
      { label: "Lower back pain", message: "Lower back support matters to me." },
      { label: "Shoulder pressure", message: "I need pressure relief at my shoulders." },
      { label: "Hip pressure", message: "I need pressure relief at my hips." },
    ];
  }

  if (inComparison) {
    return [
      { label: "More support", message: "I want something with stronger support." },
      { label: "Softer feel", message: "I want a softer feel." },
      { label: "Best value", message: "I care most about getting the best value." },
    ];
  }

  return [
    { label: "Pressure relief", message: "Pressure relief matters most to me." },
    { label: "Cooling", message: "Cooling matters most to me." },
    { label: "Easy movement", message: "I want it to be easy to move around on." },
  ];
}

function getComparisonNote(matches: MatchResult[], mode: ConversationMode) {
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
}: {
  message: string;
  memorySummary: string;
  conversationTranscript: ChatMessage[];
}) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      memorySummary,
      conversationTranscript: conversationTranscript.map(({ role, text }) => ({ role, text })),
    }),
  });

  return response.json();
}

export default function Home() {
  const storedSession = getStoredSession();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const overlayBodyRef = useRef<HTMLDivElement | null>(null);
  const queuedMessagesRef = useRef<string[]>([]);
  const inactivityTimerRef = useRef<number | null>(null);
  const matchRequestVersionRef = useRef(0);
  const [showScrollNudge, setShowScrollNudge] = useState(false);
  const [showMatchNudge, setShowMatchNudge] = useState(false);
  const [showUpdatedPulse, setShowUpdatedPulse] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationMode, setConversationMode] = useState<ConversationMode>(storedSession?.conversationMode ?? "guided-discovery");
  const [currentTheme, setCurrentTheme] = useState<string | null>(storedSession?.currentTheme ?? featuredThemes[0]?.theme ?? null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>(storedSession?.matches ?? starterMatches);
  const [messages, setMessages] = useState<ChatMessage[]>(storedSession?.messages ?? starterMessages);
  const [memorySummary, setMemorySummary] = useState(storedSession?.memorySummary ?? buildMemorySummary(starterMessages, starterMatches));
  const [showOpeningOptions, setShowOpeningOptions] = useState(false);
  const [showOtherSizes, setShowOtherSizes] = useState(false);
  const [selectedFirmnessValue, setSelectedFirmnessValue] = useState(50);
  const [selectedSize, setSelectedSize] = useState<string | null>(storedSession?.selectedSize ?? null);
  const [sizeCapturedViaPill, setSizeCapturedViaPill] = useState(storedSession?.sizeCapturedViaPill ?? false);
  const [firmnessAnswered, setFirmnessAnswered] = useState(storedSession?.firmnessAnswered ?? false);
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
        messages,
        matches,
        conversationMode,
        currentTheme,
        memorySummary: nextSummary,
        selectedSize,
        sizeCapturedViaPill,
        firmnessAnswered,
      } satisfies PersistedSession),
    );
  }, [conversationMode, currentTheme, matches, messages, selectedSize, sizeCapturedViaPill, firmnessAnswered]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll chat bottom into view whenever messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // Reset inactivity timer; show scroll nudge after 30s of shopper idle time
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss scroll nudge when the panel body is scrolled
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

  async function processMessage(messageText: string, options?: MessageOptions) {
    const trimmed = messageText.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const transcriptForTurn = [...messages, userMessage];
    const nextMemorySummary = options?.overrideMemorySummary ?? buildMemorySummary(transcriptForTurn, matches);

    setMessages((current) => [...current, userMessage]);
    setDraftMessage("");
    setIsLoading(true);

    if (!options?.skipBackgroundMatch) {
      const requestVersion = ++matchRequestVersionRef.current;
      void fetchMatches({
        message: trimmed,
        memorySummary: nextMemorySummary,
        conversationTranscript: transcriptForTurn,
      })
        .then((matchPayload) => {
          if (requestVersion !== matchRequestVersionRef.current) return;
          const incomingMatches: MatchResult[] = matchPayload.matches ?? [];
          setMatches(incomingMatches);
          if (incomingMatches.length > 0) {
            setShowMatchNudge(true);
            setShowUpdatedPulse(true);
            window.setTimeout(() => setShowMatchNudge(false), 1500);
            window.setTimeout(() => setShowUpdatedPulse(false), 1800);
            setCurrentTheme(incomingMatches[0]?.theme ?? null);
          }
        })
        .catch(() => {
          // quietly preserve current recommendations if background matching fails
        });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          currentTheme,
          shopperId: shopperMemory?.shopperId,
          conversationMode,
          memorySummary: nextMemorySummary,
          matches,
          conversationTranscript: transcriptForTurn.map(({ role, text }) => ({ role, text })),
        }),
      });

      const payload = await response.json();
      setConversationMode(payload.mode ?? "guided-discovery");

      if (!options?.skipAssistantReply) {
        const assistantId = `assistant-${Date.now()}`;
        const fullReply = payload.reply ?? "I’ve got enough to keep refining the recommendation.";

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
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    }
    await submitMessage(draftMessage);
  }

  const comparisonNote = getComparisonNote(matches, conversationMode);
  const compareThemes = useMemo(() => matches.slice(0, 2).map(getMatchTheme).filter(Boolean) as ThemeRecord[], [matches]);
  const compareWinner = compareThemes[0] ?? null;
  const dynamicReplyPills = useMemo(() => getDynamicReplyPills(messages, memorySummary, matches), [messages, memorySummary, matches]);
  const shouldAskFirmness = sizeCapturedViaPill && !!selectedSize && !firmnessAnswered;
  const showDynamicSections = matches.length > 0 && !shouldAskFirmness;

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
    const combinedMessage = `${selectedSize}. I want a ${selectedFirmness.label} feel.`;
    const syntheticTranscript = [
      ...messages,
      { id: `synthetic-size-${Date.now()}`, role: "user" as const, text: selectedSize },
      { id: `synthetic-firmness-${Date.now()}`, role: "user" as const, text: `I want a ${selectedFirmness.label} feel.` },
    ];
    const nextSummary = buildMemorySummary(syntheticTranscript, matches);
    await submitMessage(combinedMessage, { overrideMemorySummary: nextSummary });
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

            <div className={styles.resultsMeta}>
              <strong>Shop Mattresses</strong>
              <span>Scrape-derived shell with RTG-category visuals and structure</span>
            </div>

            <div className={styles.productGrid}>
              {featuredThemes.map((theme) => (
                <article
                  key={theme.theme}
                  className={`${styles.productTile} ${currentTheme === theme.theme ? styles.productTileActive : ""}`}
                  onClick={() => setCurrentTheme(theme.theme)}
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
            <span className={styles.edgeLabel}>Shop Pilot</span>
          </button>

          <div className={styles.overlayBody} ref={overlayBodyRef}>
            <div className={styles.panelBrandBar}>
              <div className={styles.panelBrandCluster}>
                <Image src="/assets/rooms-to-go-logo-2.png" alt="Rooms To Go" width={260} height={64} className={styles.panelPartnerImage} />
              </div>
              <button
                type="button"
                className={styles.panelIconButton}
                onClick={() => {
                  setMessages(starterMessages);
                  setMatches(starterMatches);
                  setConversationMode("guided-discovery");
                  setCurrentTheme(featuredThemes[0]?.theme ?? null);
                  setDraftMessage("");
                  setShowOpeningOptions(false);
                  setSelectedSize(null);
                  setSizeCapturedViaPill(false);
                  setFirmnessAnswered(false);
                  window.setTimeout(() => {
                    setShowOpeningOptions(true);
                    inputRef.current?.focus();
                  }, 420);
                }}
                aria-label="Restart chat"
                title="Restart chat"
              >
                ↻
              </button>
            </div>

            <section className={styles.chatSurface}>
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
                {/* Scroll anchor — kept inside messageList so auto-scroll tracks latest message */}
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
                          if (isNotSure) {
                            submitMessage(option);
                          } else {
                            setMessages((current) => [
                              ...current,
                              {
                                id: `user-${Date.now()}`,
                                role: "user",
                                text: option,
                              },
                            ]);
                            setDraftMessage("");
                            setShowOpeningOptions(false);
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
                            setMessages((current) => [
                              ...current,
                              {
                                id: `user-${Date.now()}`,
                                role: "user",
                                text: size,
                              },
                            ]);
                            setDraftMessage("");
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

              {shouldAskFirmness ? (
                <section className={styles.firmnessPrompt}>
                  <div className={styles.firmnessPromptHeader}>
                    <span>Next up</span>
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
                      submitMessage("It’s complicated");
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
            </section>

            {showDynamicSections ? (
              <>
                <section className={styles.suggestedSection}>
                  <span className={styles.suggestedLabel}>Easy Reply</span>
                  <div className={styles.chipsSection}>
                    {dynamicReplyPills.map((pill) => (
                      <button key={pill.label} type="button" onClick={() => submitMessage(pill.message)}>{pill.label}</button>
                    ))}
                  </div>
                </section>

                <section className={`${styles.recommendationSection} ${showUpdatedPulse ? styles.recommendationSectionPulse : ""}`}>
                  <div className={styles.sectionHeader}>
                    <h3>Top matches right now</h3>
                    <p>Tailored to what the shopper has told us so far</p>
                  </div>
                  <div className={styles.candidateScroller}>
                    <div className={styles.candidateList}>
                      {matches.map((match, index) => {
                        const theme = getMatchTheme(match);
                        const coolingScore = getFeatureScore(theme?.temperatureManagement?.label);
                        const supportScore = getFeatureScore(theme?.supportLevel?.label);
                        const pressureScore = getFeatureScore(theme?.pressureRelief?.label);

                        return (
                          <article key={match.theme} className={styles.candidateCard}>
                            <div className={styles.candidateImageWrap}>
                              {theme?.heroImage ? (
                                <Image src={theme.heroImage} alt={match.displayName} fill unoptimized className={styles.candidateImage} />
                              ) : null}
                            </div>
                            <div className={styles.candidateCardBody}>
                              <div className={styles.candidateTopRow}>
                                <p>{match.brand}</p>
                                {index === 0 ? <span className={styles.bestFitPill}>Best fit</span> : null}
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
                  </div>
                </section>

                {comparisonNote ? <section className={styles.compareBanner}>{comparisonNote}</section> : null}

                {compareThemes.length >= 2 ? (
                  <section className={styles.compareSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Compare top options</h3>
                      <p>Side-by-side based on the shopper’s current priorities</p>
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

          {/* Scroll nudge overlay — appears after 30s inactivity when recommendations are ready */}
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
