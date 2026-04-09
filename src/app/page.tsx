"use client";

import { FormEvent, useEffect, useState } from "react";
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
};

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
    text: "What matters most for your mattress, cooler sleep, pressure relief, support, or price?",
  },
];
const starterMatches: MatchResult[] = featuredThemes.slice(0, 3).map((theme, index) => ({
  theme: theme.theme,
  displayName: theme.displayName,
  brand: theme.brand,
  type: theme.type,
  comfort: theme.comfort,
  priceFrom: theme.priceRange?.min ?? null,
  score: 3 - index,
}));

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
    .slice(-3)
    .map((message) => message.text)
    .join(" ")
    .toLowerCase();

  const preferences = [
    userText.includes("side") ? "side-sleeper" : null,
    userText.includes("back") ? "back-sleeper" : null,
    userText.includes("hot") || userText.includes("cool") ? "cooling-conscious" : null,
    userText.includes("medium") ? "medium-feel" : null,
    userText.includes("firm") ? "firm-feel" : null,
    userText.includes("budget") || userText.includes("under") || userText.includes("$") ? "budget-aware" : null,
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

  if ((lowerSummary.includes("cool") || lowerSummary.includes("hot")) && [match.type, match.comfort, match.displayName].join(" ").toLowerCase().match(/cool|foam|hybrid/)) {
    reasons.push("Cooling fit");
  }
  if (lowerSummary.includes("side") && [match.comfort, match.displayName].join(" ").toLowerCase().match(/plush|medium/)) {
    reasons.push("Good for side sleeping");
  }
  if (lowerSummary.includes("budget") || lowerSummary.includes("under") || lowerSummary.includes("$") || lowerSummary.includes("budget-aware")) {
    if ((match.priceFrom ?? 999999) < 2000) reasons.push("Budget aligned");
  }
  if (!reasons.length) reasons.push("Strong overall match");

  return reasons.slice(0, 3);
}

function RoomsToGoLogo() {
  return (
    <svg viewBox="0 0 275 32" role="img" aria-label="Rooms To Go" className={styles.logoSvg}>
      <path fill="currentColor" d="M0 .5h7.6c4 0 6 .5 7.4 1.1 3.4 1.6 5.4 4.9 5.4 8.6 0 4.4-3.1 8.8-8.9 9.1L20 30.5h-3.8L5.9 16.9c3.8 0 5.1 0 6.5-.4 3.3-.9 5-3.7 5-6.4 0-2.4-1.3-4.8-3.3-5.8-1.8-.9-3.3-1.1-5.8-1.1H3v27.3H0V.5zM87.4.5H92l11 25.6L113.9.5h4.6v30h-3V3.8l-11.3 26.7h-2.6L90.5 3.8h-.1v26.7h-3zM124.8 22.1c.2 3.8 2.6 6.2 6.2 6.2 3.2 0 6.1-2.4 6.1-6 0-4.6-4.7-5.8-6.7-6.4-2.7-.8-7.8-2-7.8-7.9 0-4.7 3.7-8.1 8.4-8.1 4.9 0 8.3 3.8 8.3 8.2h-3c0-3-2.5-5.4-5.3-5.4-3.4 0-5.4 2.6-5.4 5.2 0 3.7 3.2 4.5 7.1 5.6 7.4 2 7.4 7.8 7.4 8.7 0 4.6-3.7 8.8-9.1 8.8-3.9 0-9.1-2.3-9.2-8.9h3zM155.8 3.2h-6.9V.5h16.8v2.7h-6.9v27.3h-3zM219.3 18.2h15.2c-.6 2.7-2.1 5.1-4.3 6.8-2.2 1.8-5 2.7-7.8 2.7-6.8 0-12.4-5.6-12.4-12.4s5.6-12.4 12.4-12.4c2 0 3.9.5 5.6 1.4 1.7.9 3.2 2.1 4.3 3.6h3.7v-.1c-2.7-5-7.9-8.1-13.6-8.1-8.5 0-15.5 7-15.5 15.5s7 15.5 15.5 15.5C231 31 238 24 238 15.5h-18.7v2.7zM52.1 11.1c-.7-2.4-2-4.7-3.9-6.6C44.1.3 38.1-1 32.9.6c-2.4.7-4.7 2-6.6 3.9-1.9 1.9-3.2 4.2-3.9 6.6-1.5 5.3-.2 11.2 3.9 15.4 1.9 1.9 4.2 3.2 6.6 3.9 5.3 1.5 11.2.2 15.4-3.9 4.1-4.2 5.4-10.2 3.8-15.4m-6 13.2c-3.6 3.6-8.7 4.5-13.2 2.8-1.6-.6-3.1-1.5-4.4-2.8-3.6-3.6-4.5-8.7-2.8-13.2.6-1.6 1.5-3.1 2.8-4.4s2.8-2.2 4.4-2.8c4.4-1.7 9.6-.7 13.2 2.8 1.3 1.3 2.2 2.8 2.8 4.4 1.7 4.4.7 9.6-2.8 13.2M84.5 11.1c-.7-2.4-2-4.7-3.9-6.6C76.4.3 70.5-1 65.2.6c-2.4.7-4.7 2-6.6 3.9-1.9 1.9-3.2 4.2-3.9 6.6-1.5 5.3-.2 11.2 3.9 15.4 1.9 1.9 4.2 3.2 6.6 3.9 5.3 1.5 11.2.2 15.4-3.9s5.4-10.2 3.9-15.4m-6.1 13.2c-3.6 3.6-8.7 4.5-13.2 2.8-1.6-.6-3.1-1.5-4.4-2.8-3.6-3.6-4.5-8.7-2.8-13.2.6-1.6 1.5-3.1 2.8-4.4s2.8-2.2 4.4-2.8c4.4-1.7 9.6-.7 13.2 2.8 1.3 1.3 2.2 2.8 2.8 4.4 1.7 4.4.8 9.6-2.8 13.2M188.8 1.8c-2.2-1.2-4.7-1.9-7.4-1.9-5.9 0-11 3.3-13.6 8.1a15.358 15.358 0 0 0 0 14.8c2.6 4.8 7.8 8.1 13.6 8.1 2.7 0 5.2-.7 7.4-1.9 4.8-2.6 8.1-7.8 8.1-13.6s-3.3-10.9-8.1-13.6m-2.3 25c-1.6.7-3.3 1.1-5.1 1.1-5 0-9.4-3-11.3-7.3-.7-1.6-1.1-3.3-1.1-5.1 0-1.8.4-3.6 1.1-5.1C172 6 176.4 3 181.4 3c1.8 0 3.6.4 5.1 1.1 4.3 2 7.3 6.3 7.3 11.3 0 5.1-3 9.4-7.3 11.4M268.9 8c-2.6-4.8-7.8-8.1-13.6-8.1-2.7 0-5.2.7-7.4 1.9-4.8 2.6-8.1 7.8-8.1 13.6s3.3 11 8.1 13.6c2.2 1.2 4.7 1.9 7.4 1.9 5.9 0 11-3.3 13.6-8.1 1.2-2.2 1.9-4.7 1.9-7.4 0-2.6-.7-5.2-1.9-7.4m-2.3 12.6c-2 4.3-6.3 7.3-11.3 7.3-1.8 0-3.6-.4-5.1-1.1-4.3-2-7.3-6.3-7.3-11.3s3-9.4 7.3-11.3c1.6-.7 3.3-1.1 5.1-1.1 5 0 9.4 3 11.3 7.3.7 1.6 1.1 3.3 1.1 5.1 0 1.8-.4 3.5-1.1 5.1" />
      <path fill="#ffc600" d="M48 15.5c0 5.9-4.8 10.7-10.7 10.7-1.5 0-2.8-.3-4.1-.8-3.9-1.6-6.6-5.4-6.6-9.9 0-1.5.3-2.8.8-4.1 1.1-2.6 3.2-4.7 5.8-5.8 1.3-.5 2.6-.8 4.1-.8 4.4 0 8.3 2.7 9.9 6.6.5 1.2.8 2.6.8 4.1zM80.3 15.5c0 5.9-4.8 10.7-10.7 10.7-1.5 0-2.8-.3-4.1-.8-3.9-1.6-6.6-5.4-6.6-9.9 0-1.5.3-2.8.8-4.1 1.1-2.6 3.2-4.7 5.8-5.8 1.3-.5 2.6-.8 4.1-.8 4.4 0 8.3 2.7 9.9 6.6.5 1.2.8 2.6.8 4.1z" />
      <path fill="#c00d03" d="M192.1 15.5c0 4.5-2.7 8.3-6.6 9.9-1.3.5-2.6.8-4.1.8-4.5 0-8.3-2.7-9.9-6.6-.5-1.3-.8-2.6-.8-4.1s.3-2.8.8-4.1c1.6-3.9 5.4-6.6 9.9-6.6 1.5 0 2.8.3 4.1.8 3.8 1.6 6.6 5.4 6.6 9.9z" />
      <path fill="#169162" d="M265.2 11.4c-1.6-3.9-5.4-6.6-9.9-6.6-1.5 0-2.8.3-4.1.8-3.9 1.6-6.6 5.4-6.6 9.9 0 4.4 2.7 8.3 6.6 9.9 1.3.5 2.6.8 4.1.8 4.5 0 8.3-2.7 9.9-6.6.3-.6.5-1.3.6-2 .1-.7.2-1.4.2-2.1 0-1.5-.3-2.9-.8-4.1z" />
      <path fill="#fff" d="M252.3 24.2V6.7l8.8 8.7z" />
    </svg>
  );
}

export default function Home() {
  const storedSession = getStoredSession();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationMode, setConversationMode] = useState<ConversationMode>(storedSession?.conversationMode ?? "guided-discovery");
  const [currentTheme, setCurrentTheme] = useState<string | null>(storedSession?.currentTheme ?? featuredThemes[0]?.theme ?? null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>(storedSession?.matches ?? starterMatches);
  const [messages, setMessages] = useState<ChatMessage[]>(storedSession?.messages ?? starterMessages);
  const [memorySummary, setMemorySummary] = useState(storedSession?.memorySummary ?? buildMemorySummary(starterMessages, starterMatches));
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
      } satisfies PersistedSession),
    );
  }, [conversationMode, currentTheme, matches, messages]);

  async function submitMessage(messageText: string) {
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: messageText.trim(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraftMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          currentTheme,
          shopperId: shopperMemory?.shopperId,
          conversationMode,
          memorySummary,
        }),
      });

      const payload = await response.json();
      setConversationMode(payload.mode ?? "guided-discovery");
      setMatches(payload.matches ?? []);

      if (payload.matches?.[0]?.theme) {
        setCurrentTheme(payload.matches[0].theme);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply ?? "I’ve got enough to keep refining the recommendation.",
        },
      ]);
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
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage(draftMessage);
  }


  return (
    <div className={styles.page}>
      <main className={styles.viewport}>
        <section className={`${styles.siteSurface} ${isOpen ? styles.siteSurfaceShifted : ""}`}>
          <header className={styles.mainHeader}>
            <div className={styles.headerRow}>
              <button type="button" className={styles.iconButton}>☰</button>
              <div className={styles.logoWrap}>
                <RoomsToGoLogo />
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
                  <div className={styles.productImagePlaceholder}>
                    <span>{theme.brand}</span>
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

          <div className={styles.overlayBody}>

            <section className={styles.chatSurface}>
              <div className={styles.messageList}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "assistant" ? styles.messageAssistant : styles.messageUser}
                  >
                    <p>{message.text}</p>
                  </div>
                ))}
                {isLoading ? (
                  <div className={styles.messageAssistant}>
                    <p>Thinking through the conversational layer and checking the match set…</p>
                  </div>
                ) : null}
              </div>

              <form className={styles.composer} onSubmit={handleSubmit}>
                <input
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Tell Shop Pilot what matters most to you"
                  aria-label="Message Shop Pilot"
                />
                <button type="submit" disabled={isLoading}>{isLoading ? "..." : "Send"}</button>
              </form>
            </section>

            <section className={styles.chipsSection}>
              <button type="button" onClick={() => submitMessage("I’m a side sleeper and sleep hot.")}>Side sleeper</button>
              <button type="button" onClick={() => submitMessage("Cooling matters most to me.")}>Cooling matters</button>
              <button type="button" onClick={() => submitMessage("I want a medium feel.")}>Medium feel</button>
              <button type="button" onClick={() => submitMessage("Keep me under $2,000.")}>Budget under $2k</button>
            </section>

            <section className={styles.recommendationSection}>
              <div className={styles.sectionHeader}>
                <h3>Top matches right now</h3>
                <p>Tailored to what the shopper has told us so far</p>
              </div>
              <div className={styles.candidateList}>
                {matches.map((match) => (
                  <article key={match.theme} className={styles.candidateCard}>
                    <p>{match.brand}</p>
                    <h4>{match.displayName}</h4>
                    <span>{match.type || "Type TBD"} · {match.comfort || "Comfort TBD"}</span>
                    <strong>{match.priceFrom ? `From $${match.priceFrom.toLocaleString()}` : "Price TBD"}</strong>
                    <div className={styles.reasonList}>
                      {getFitReasons(match, memorySummary).map((reason) => (
                        <em key={reason}>{reason}</em>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </div>
        </aside>
      </main>
    </div>
  );
}
