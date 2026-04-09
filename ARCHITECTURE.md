# Shop Pilot RTG Demo — Architecture Notes

## Overview

This is a desktop-only demo of **Shop Pilot**, an AI-powered mattress shopping assistant, overlaid on a scrape-derived Rooms To Go mattress category shell.

The goal is to show RTG what a premium, catalog-aware, shopper-contextual chat experience could feel like on their own site — without them having to imagine it.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | CSS Modules |
| AI | Anthropic Claude Sonnet 4.6 via SDK |
| Data | Normalized JSON from RTG catalog CSVs |
| Persistence | `localStorage` (session) + first-party cookie (shopper ID) |
| Deploy | Vercel (manual CLI deploys) |
| Repo | github.com/zapblake/shop-pilot-rtg-demo |

---

## Two-Agent Architecture

```
Shopper message
     │
     ▼
┌──────────────────┐
│  Conversational  │  /api/chat
│  Agent           │  Claude Sonnet 4.6
│                  │  Warm, concise, asks one question
└────────┬─────────┘
         │  calls selectively when shopper intent
         │  includes size/feel/cooling/firmness/brand signals
         ▼
┌──────────────────┐
│  Mattress Match  │  /api/match
│  Agent           │  Keyword heuristic scoring
│                  │  Filters by size availability
└────────┬─────────┘
         │  returns top 3 ranked candidates
         ▼
┌──────────────────┐
│  UI Orchestrator │  src/app/page.tsx
│  (app logic)     │  Renders chat, candidates, compare
└──────────────────┘
```

### Conversational Agent (`/api/chat`)
- Uses Claude Sonnet 4.6 (`claude-sonnet-4-20250514`)
- Receives: shopper message, memory summary, conversation mode, top match candidates
- Returns: reply (streamed in UI), updated mode, refreshed match list
- Behavior rules:
  - Never names models or brands in replies
  - Never mentions price unless shopper asks
  - Tells shopper to scroll down to see recommendations
  - Always ends with one bold question
  - Falls back to deterministic reply if API key missing or call fails

### Mattress Match Agent (`/api/match`)
- Pure keyword heuristic scoring over `mattressThemes.normalized.json`
- Combines live message + memory summary for signal extraction
- **Hard-filters by size**: if shopper stated Queen, only Queen-available themes pass
- Boosts brand matches (+6) when shopper asks about a specific brand
- Returns top 3 ranked matches (theme metadata + score)

---

## Shopper Continuity

- **Shopper ID**: first-party cookie (`shop-pilot-demo-shopper`), 30-day TTL
- **Session memory**: `localStorage` (`shop-pilot-demo-session`) — stores messages, matches, mode, currentTheme, memorySummary
- **Memory summary**: last 4 user messages → extracted preference signals (size, feel, sleep position, cooling) → plain-text summary injected into every API call
- This means returning shoppers carry context without replaying full transcripts

---

## Conversation Flow

```
1. Greeting + size prompt (assistant opens)
2. Size quick-reply or typed → Match Agent called
3. Firmness slider shown as second step
4. Firmness submitted → Match Agent re-called with combined context
5. Richer recommendation + compare modules appear below chat
6. Follow-up questions narrow: cooling → position → pressure relief
7. Compare offered contextually, not as a permanent CTA
```

---

## UI State

| State | Description |
|---|---|
| `conversationMode` | `guided-discovery` → `product-evaluation` → `comparison` |
| `matches` | Top 3 candidate themes from match agent |
| `currentTheme` | Leading match theme key |
| `shouldAskFirmness` | True after first user message, triggers slider |
| `showDynamicSections` | True after firmness answered; unlocks recommendation + compare modules |
| `queuedMessagesRef` | Ref-backed queue so shopper can reply during loading |

---

## Key Design Decisions

- **No horizontal scroll fade** — removed; it was obscuring the second tile
- **Compare limited to 2 cards** — cleaner, fills width evenly, avoids decision fatigue
- **Size filtering is hard** — wrong-size results destroy trust. The match agent filters before scoring.
- **Chat never narrates recommendations** — it directs shoppers to scroll down. The UI does the product work.
- **Streaming is simulated** — response arrives in full, then character-chunks render at ~18ms intervals. Real SSE streaming would replace this in production.
- **Firmness is a slider, not a choice list** — continuous drag maps to 5 named stops: Plush / Medium-plush / Medium / Medium-firm / Firm
- **Queue pattern for loading** — if shopper replies during `isLoading`, message is queued and processed in order after current response settles

---

## Data Files

| File | Description |
|---|---|
| `src/data/mattressThemes.normalized.json` | 101 theme-level records with size, feel, cooling, pricing |
| `src/data/mattresses.normalized.json` | 486 individual SKU-level records |
| `src/data/accessories.normalized.json` | 146 accessory records |
| `src/data/schema.json` | Field definitions for all normalized outputs |

Source CSVs: `memory/rtg-catalog.csv`, `memory/rtg-mattress-info.csv`, `memory/rtg-mattress-photos.csv`, `memory/rtg-accessories.csv`

---

## Open TODOs

- [ ] True SSE streaming (replace simulated character-chunk streaming)
- [ ] Preference-weighted compare winner (currently rank-ordered, not shopper-priority-weighted)
- [ ] Compare offered contextually at the right journey moment, not only when explicitly triggered
- [ ] Return/resume behavior — returning shopper greeted with their size/firmness already in context
- [ ] Live RTG site overlay (current shell is scrape-derived, not true iframe/proxy)
- [ ] PDP-aware behavior (detect when shopper lands on a product detail page)
- [ ] Product imagery from catalog (current images are theme-level, not SKU-specific)

---

_Last updated: 2026-04-09_
