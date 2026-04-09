"use client";

import { useMemo, useState } from "react";
import mattressThemes from "@/data/mattressThemes.normalized.json";
import styles from "./page.module.css";

type ConversationMode =
  | "welcome"
  | "guided-discovery"
  | "product-evaluation"
  | "comparison"
  | "resume";

const featuredThemes = mattressThemes.slice(0, 4);
const SHOPPER_COOKIE_KEY = "shop-pilot-demo-shopper";

type ShopperMemory = {
  shopperId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  summary: string;
};

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

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationMode] = useState<ConversationMode>("guided-discovery");
  const [currentTheme, setCurrentTheme] = useState(featuredThemes[0]?.theme ?? null);
  const [shopperMemory] = useState<ShopperMemory | null>(() => {
    const now = new Date().toISOString();
    const existingId = getCookie(SHOPPER_COOKIE_KEY);

    if (existingId) {
      setCookie(SHOPPER_COOKIE_KEY, existingId, 30);
      return {
        shopperId: existingId,
        firstSeenAt: now,
        lastSeenAt: now,
        summary:
          "Returning shopper interested in cooling, side-sleeper support, and medium-feel options around a mid-range budget.",
      };
    }

    const generatedId = `demo-${Math.random().toString(36).slice(2, 10)}`;
    setCookie(SHOPPER_COOKIE_KEY, generatedId, 30);
    return {
      shopperId: generatedId,
      firstSeenAt: now,
      lastSeenAt: now,
      summary: "New shopper session. No durable preferences captured yet.",
    };
  });

  const runtimeContext = useMemo(() => {
    const theme = featuredThemes.find((item) => item.theme === currentTheme) ?? null;

    return {
      shopperId: shopperMemory?.shopperId ?? "loading",
      pageType: "category",
      currentUrl: "https://www.roomstogo.com/mattress",
      currentSku: null,
      currentTheme: theme?.theme ?? null,
      currentProductSummary: theme
        ? `${theme.displayName} · ${theme.type || "Type TBD"} · ${theme.comfort || "Comfort TBD"}`
        : null,
      conversationMode,
      shopperPreferences: {
        sleepPositions: ["side"],
        coolingPriority: "high",
        comfortPreference: "medium",
        budgetBand: "under-2000",
      },
      shortlistedThemes: featuredThemes.slice(0, 3).map((item) => item.theme),
      compareSet: featuredThemes.slice(0, 2).map((item) => item.theme),
      priorConversationSummary: shopperMemory?.summary ?? "Loading shopper memory",
      topCandidateThemes: featuredThemes.slice(0, 3).map((item) => item.theme),
      recentInteractionTimestamp: shopperMemory?.lastSeenAt ?? "loading",
    };
  }, [conversationMode, currentTheme, shopperMemory]);

  return (
    <div className={styles.page}>
      <main className={styles.viewport}>
        <section className={`${styles.siteSurface} ${isOpen ? styles.siteSurfaceShifted : ""}`}>
          <div className={styles.browserTopbar}>
            <div className={styles.browserDots}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.browserUrl}>roomstogo.com/mattress</div>
          </div>

          <div className={styles.browserContent}>
            <div className={styles.mockSiteHeader}>
              <div>
                <p className={styles.eyebrow}>Rooms To Go Mattress</p>
                <h1>Find the right mattress for how you actually sleep.</h1>
                <p className={styles.subcopy}>
                  Premium guidance, brand-safe recommendations, and a calmer path to the right fit.
                </p>
              </div>
              <div className={styles.mockActions}>
                <button type="button">Shop by comfort</button>
                <button type="button">Compare brands</button>
              </div>
            </div>

            <div className={styles.heroBand}>
              <div className={styles.heroCard}>
                <p>Cooling help</p>
                <strong>Hot sleeper options that do not feel clinical</strong>
              </div>
              <div className={styles.heroCard}>
                <p>Support</p>
                <strong>Guided picks for side sleepers and pressure relief</strong>
              </div>
              <div className={styles.heroCard}>
                <p>Budget clarity</p>
                <strong>Quick narrowing without bouncing between tabs</strong>
              </div>
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
          </div>
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

          <div className={`${styles.overlayBody} ${isOpen ? styles.overlayBodyOpen : styles.overlayBodyClosed}`}>
            <div className={styles.overlayHeader}>
              <div>
                <p className={styles.overlayKicker}>RTG Chat</p>
                <h2>Shop Pilot</h2>
              </div>
              <p className={styles.headerMicrocopy}>Helpful, calm, and context-aware.</p>
            </div>

            <section className={styles.chatSurface}>
              <div className={styles.messageAssistant}>
                <p>
                  Welcome in. I can help narrow things down quickly without making this feel like homework.
                </p>
              </div>
              <div className={styles.messageUser}>
                <p>I sleep on my side, get hot, and want to stay under about $2,000.</p>
              </div>
              <div className={styles.messageAssistant}>
                <p>
                  Great, that gives us something useful to work with. I’d keep the conversation flowing here while the match agent narrows the best cooling-friendly side-sleeper options in the background.
                </p>
              </div>
            </section>

            <section className={styles.chipsSection}>
              <button type="button">Side sleeper</button>
              <button type="button">Cooling matters</button>
              <button type="button">Medium feel</button>
              <button type="button">Budget under $2k</button>
            </section>

            <section className={styles.recommendationSection}>
              <div className={styles.sectionHeader}>
                <h3>Top matches right now</h3>
                <p>Starter UI for backend match-agent output</p>
              </div>
              <div className={styles.candidateList}>
                {featuredThemes.slice(0, 3).map((theme) => (
                  <article key={theme.theme} className={styles.candidateCard}>
                    <p>{theme.brand}</p>
                    <h4>{theme.displayName}</h4>
                    <span>
                      {theme.type || "Type TBD"} · {theme.comfort || "Comfort TBD"}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.contextCard}>
              <h3>Internal runtime state</h3>
              <dl>
                <div>
                  <dt>Shopper ID</dt>
                  <dd>{runtimeContext.shopperId}</dd>
                </div>
                <div>
                  <dt>Experience mode</dt>
                  <dd>Adaptive guided assistance</dd>
                </div>
                <div>
                  <dt>Current theme</dt>
                  <dd>{runtimeContext.currentTheme ?? "None"}</dd>
                </div>
                <div>
                  <dt>Memory summary</dt>
                  <dd>{runtimeContext.priorConversationSummary}</dd>
                </div>
              </dl>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}
