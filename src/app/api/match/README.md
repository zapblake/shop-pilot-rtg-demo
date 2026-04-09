# /api/match — Mattress Match Agent

## Purpose

Deterministic catalog-grounding layer. Scores all 101 mattress themes against
shopper signals extracted from the current message + memory summary.

## Key behaviors

### Size filtering (hard filter, applied before scoring)
If the shopper stated a size (queen, king, twin, full, cal king), only themes
that carry that size are included. This prevents recommending mattresses the
shopper can't actually buy.

Size is extracted from both the live message AND the memory summary, so a
Queen stated early in the conversation is honored for the rest of the session.

### Brand matching
If the shopper mentions a brand (Helix, Sealy, Beautyrest, etc.), themes from
that brand are boosted by +6 before other signals are scored. This surfaces
the right brand matches without the chat hallucinating "we don't carry that."

### Scoring signals
| Signal | Keyword match | Score boost |
|---|---|---|
| Cooling / heat | cool, hot → hybrid/foam themes | +2 |
| Side sleeping | side → plush/medium themes | +2 |
| Medium feel | medium → medium themes | +2 |
| Firm feel | firm → firm themes | +2 |
| Budget | budget/under/$ → low-price themes | +1 |

## Response

```json
{
  "matches": [
    {
      "theme": "adapt-2-0-medium",
      "displayName": "Adapt 2.0 Medium",
      "brand": "Tempur-Pedic",
      "type": "Memory Foam",
      "comfort": "Medium",
      "priceFrom": 2199,
      "score": 4
    }
  ],
  "trace": {
    "agent": "mattress-match",
    "invoked": true,
    "requestedSize": "queen",
    "requestedBrand": null,
    "reason": "Filtered to queen availability"
  }
}
```
