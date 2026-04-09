# /api/chat — Conversational Agent

## Purpose

Handles all shopper-facing replies. Uses Claude Sonnet 4.6 for live generation.
Calls `/api/match` selectively when the shopper message contains shopping signals.

## Request body

```json
{
  "message": "I sleep hot and need a queen",
  "memorySummary": "queen-size shopper. cooling-conscious.",
  "matches": [...],
  "conversationMode": "guided-discovery"
}
```

## Response

```json
{
  "reply": "...",
  "mode": "product-evaluation",
  "matches": [...],
  "liveModel": true
}
```

## Behavior rules (enforced in system prompt)

- Never name mattress models or brands in chat replies
- Never mention price unless shopper explicitly asks
- Tell shoppers to scroll down to see their current recommendations
- Always end with one clear shopper-facing question, bolded with `**...**`
- Falls back to deterministic reply if API key is absent or call fails

## Fallback logic

`buildFallbackReply()` handles:
- Brand-ask intent → scroll-down redirect
- Compare intent → scroll-down + compare invite
- Default → scroll-down + next narrowing question
