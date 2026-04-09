import mattressThemes from "@/data/mattressThemes.normalized.json";
import mattresses from "@/data/mattresses.normalized.json";
import accessories from "@/data/accessories.normalized.json";
import styles from "./page.module.css";

const topThemes = mattressThemes.slice(0, 3);
const sampleAccessories = accessories.slice(0, 3);

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Shop Pilot x Rooms To Go</p>
            <h1>RTG mattress overlay demo scaffold</h1>
            <p className={styles.description}>
              Initial build scaffold for the live-site overlay experience. Data is
              wired in, the app shell is ready, and the next step is building the
              right-rail assistant and context engine.
            </p>
          </div>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Theme models</span>
              <strong>{mattressThemes.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>SKU records</span>
              <strong>{mattresses.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Accessories</span>
              <strong>{accessories.length}</strong>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Recommended architecture</h2>
            <p>Two-agent recommendation model with fast UI orchestration.</p>
          </div>
          <div className={styles.cardGrid}>
            <article className={styles.infoCard}>
              <h3>Conversational Agent</h3>
              <p>
                Shopper-facing, fast, premium tone, decides when to invoke the
                backend matcher.
              </p>
              <span>Model: Claude Sonnet 4.6</span>
            </article>
            <article className={styles.infoCard}>
              <h3>Mattress Match Agent</h3>
              <p>
                Backend specialist responsible for preference-aware narrowing,
                ranking, and recommendation reasoning.
              </p>
              <span>Model: Claude Sonnet 4.6</span>
            </article>
            <article className={styles.infoCard}>
              <h3>UI Orchestrator</h3>
              <p>
                Controls overlay state, page context, compare UI, and shopper
                continuity.
              </p>
              <span>Model: app logic</span>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Sample mattress themes</h2>
            <p>Normalized theme-level records now available to the app.</p>
          </div>
          <div className={styles.cardGrid}>
            {topThemes.map((theme) => (
              <article key={theme.theme} className={styles.productCard}>
                <p className={styles.productBrand}>{theme.brand}</p>
                <h3>{theme.displayName}</h3>
                <p>{theme.themeSummary}</p>
                <div className={styles.metaRow}>
                  <span>{theme.type || "Type TBD"}</span>
                  <span>{theme.comfort || "Comfort TBD"}</span>
                </div>
                <strong>
                  {theme.priceRange?.min
                    ? `From $${theme.priceRange.min.toLocaleString()}`
                    : "Price TBD"}
                </strong>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Accessory support layer</h2>
            <p>Secondary recommendations can pull from normalized accessory data.</p>
          </div>
          <div className={styles.cardGrid}>
            {sampleAccessories.map((item) => (
              <article key={item.sku} className={styles.infoCard}>
                <h3>{item.title}</h3>
                <p>
                  {item.brand} · {item.category}
                </p>
                <span>
                  {item.salePrice
                    ? `$${item.salePrice.toLocaleString()}`
                    : "Price TBD"}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
