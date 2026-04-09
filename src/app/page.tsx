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

export default function Home() {
  const [isOpen, setIsOpen] = useState(true);
  const [conversationMode, setConversationMode] =
    useState<ConversationMode>("guided-discovery");
  const [currentTheme, setCurrentTheme] = useState(featuredThemes[0]?.theme ?? null);

  const runtimeContext = useMemo(() => {
    const theme = featuredThemes.find((item) => item.theme === currentTheme) ?? null;

    return {
      shopperId: "demo-shopper-001",
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
      priorConversationSummary:
        "Shopper wants cooling help, prefers medium feel, and is deciding between side-sleeper-friendly options.",
      topCandidateThemes: featuredThemes.slice(0, 3).map((item) => item.theme),
      recentInteractionTimestamp: "2026-04-09T02:29:00-05:00",
    };
  }, [conversationMode, currentTheme]);

  return (
    <div className={styles.page}>
      <main className={styles.stage}>
        <section className={styles.browserShell}>
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
              </div>
              <div className={styles.mockActions}>
                <button type="button">Shop by comfort</button>
                <button type="button">Compare brands</button>
              </div>
            </div>

            <div className={styles.productGrid}>
              {featuredThemes.map((theme) => (
                <article
                  key={theme.theme}
                  className={styles.productTile}
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
          <div className={styles.overlayHeader}>
            <div>
              <p className={styles.overlayKicker}>RTG Chat</p>
              <h2>Shop Pilot</h2>
            </div>
            <button type="button" onClick={() => setIsOpen((value) => !value)}>
              {isOpen ? "Collapse" : "Open"}
            </button>
          </div>

          {isOpen ? (
            <>
              <div className={styles.modeRow}>
                {[
                  ["guided-discovery", "Discovery"],
                  ["product-evaluation", "Product"],
                  ["comparison", "Compare"],
                  ["resume", "Resume"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={conversationMode === value ? styles.modeActive : ""}
                    onClick={() => setConversationMode(value as ConversationMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <section className={styles.chatSurface}>
                <div className={styles.messageAssistant}>
                  <p>
                    I can help narrow this down quickly. Tell me what matters most,
                    comfort, cooling, support, or budget, and I’ll guide the next step.
                  </p>
                </div>
                <div className={styles.messageUser}>
                  <p>
                    I sleep on my side, get hot, and want to stay under about $2,000.
                  </p>
                </div>
                <div className={styles.messageAssistant}>
                  <p>
                    Understood. I’d have the conversational agent acknowledge that
                    instantly, then let the mattress match agent narrow the field in
                    the background while we keep the UI responsive.
                  </p>
                </div>
              </section>

              <section className={styles.chipsSection}>
                <button type="button">Side sleeper</button>
                <button type="button">Cooling matters</button>
                <button type="button">Medium feel</button>
                <button type="button">Budget under $2k</button>
              </section>

              <section className={styles.contextCard}>
                <h3>Runtime context</h3>
                <dl>
                  <div>
                    <dt>Mode</dt>
                    <dd>{runtimeContext.conversationMode}</dd>
                  </div>
                  <div>
                    <dt>Page</dt>
                    <dd>{runtimeContext.pageType}</dd>
                  </div>
                  <div>
                    <dt>Theme</dt>
                    <dd>{runtimeContext.currentTheme ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Summary</dt>
                    <dd>{runtimeContext.currentProductSummary ?? "No active product"}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.recommendationSection}>
                <div className={styles.sectionHeader}>
                  <h3>Suggested candidates</h3>
                  <p>Starter UI for backend match-agent results</p>
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
            </>
          ) : (
            <button type="button" className={styles.reopenButton} onClick={() => setIsOpen(true)}>
              Reopen Shop Pilot
            </button>
          )}
        </aside>
      </main>
    </div>
  );
}
