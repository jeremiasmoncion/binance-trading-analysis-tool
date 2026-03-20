# Area Status Map

## Purpose

This document summarizes the redesign by major project area.

It exists so a new AI or contributor can quickly answer:

- what area this is
- why it matters
- what has already been done
- what is still incomplete
- what should likely happen next

It is meant to complement, not replace:

- `current-state.md`
- `implementation-plan.md`
- `handoff.md`
- `work-log.md`

## How To Read This

Each area is written from five angles:

- context
- current point
- completed work
- remaining work
- likely next step

---

## 1. Data Architecture

### Context

CRYPE already had a meaningful shared data foundation before the redesign.

The redesign depends on preserving and strengthening:

- shared data planes
- overlays
- selectors
- shared actions
- sync discipline

instead of letting each new page invent its own fetch/runtime model.

### Current Point

This area is active and materially advanced.

The system already uses shared market/system planes and multiple rounds of selector/runtime hardening have landed.

### Completed Work

- shared `snapshot + overlay + selector` architecture remains the foundation
- realtime overlay application became no-op aware
- realtime emit dedup became semantic instead of timestamp-literal
- hybrid dashboard/runtime refreshes became semantic
- execution payload equality was hardened
- scanner/runtime equality was hardened
- narrower selectors were introduced for template-facing pages
- `Signal Bot` now has shared selector/read-model seams instead of local repeated derivation

### Remaining Work

- continue auditing overly broad selectors
- continue finding hybrid refreshes that still republish equivalent data
- continue moving repeated view-level derivation into shared seams where appropriate
- keep template pages from reintroducing wide subscriptions just for convenience

### Likely Next Step

- continue runtime/data-plane auditing in the densest upcoming template pages
- especially around:
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - any future historical/admin-heavy surfaces

---

## 2. Performance / Runtime / Realtime

### Context

This is the structural stability area.

Its mission is to keep the app:

- fast
- stable
- low-churn
- semantically updated
- safe for more pages and denser UI

without requiring page-local hacks.

### Current Point

This area is active and progressing well.

Several important runtime seams have already been hardened, but this is ongoing work, not closed work.

### Completed Work

- semantic realtime dedup on apply side
- semantic realtime dedup on emit side
- semantic equality for dashboard refresh paths
- semantic equality for execution center payloads
- semantic equality for scanner/runtime cohorts
- narrower subscriptions for first template-facing feed pages
- shared read-model seam for `Signal Bot`

### Remaining Work

- continue performance auditing as template pages gain more density
- inspect any admin/history payloads that may scale badly
- continue preventing:
  - equivalent writes
  - oversized subscriptions
  - repeated derivation in views
  - refresh churn from freshness-only metadata

### Likely Next Step

- keep refining shared comparators/selectors
- continue architecture-level audits for seams still outside the intended pattern

---

## 3. Visual Style Architecture

### Context

CRYPE must look as literal as possible to the `TradeBotX` template, but must not copy the template's messy implementation patterns.

This area governs:

- visual fidelity
- style discipline
- reusable shared classes
- global CSS organization

### Current Point

This area is defined architecturally, but implementation is still uneven page by page.

The rules are much clearer than before, but not all pages yet meet them.

### Completed Work

- visual style rules are now documented explicitly
- `Dashboard` and `My Wallet` are established as live implementation references
- shared visual patterns continue to be preferred over isolated per-page hacks
- template flow migration now happens under explicit style-discipline rules

### Remaining Work

- literalize inner-page styling where structure is already correct but fidelity still lags
- continue translating template surfaces into CRYPE shared style primitives
- remove visual drift between:
  - template target
  - CRYPE implementation

### Likely Next Step

- continue closing pages with stricter visual fidelity review
- especially where the page is structurally correct but still not visually literal enough

---

## 4. UX / Navigation / Page Flow

### Context

The product UX is no longer freeform.

The `TradeBotX` template is now the official navigation and layout target for:

- sidebar hierarchy
- page grouping
- submenu structure
- tab layout
- page composition
- user-facing naming

### Current Point

This area is in mid-migration.

The sidebar and core flow are much closer than before, but not every surface is fully closed and not every page is equally mature.

### Completed Work

- template hierarchy became the official UX target
- new navigation flow was introduced into the app
- `Control Panel` subpages were opened
- `AI Bot` subtree was opened
- `Account` and bottom user-zone rules were documented and implemented in principle
- user-facing naming now follows template logic by default

### Remaining Work

- continue closing template pages one by one
- complete placeholder branches over time
- keep removing residual legacy flow assumptions
- ensure every preview-worthy page is reviewable as a real user-facing product surface

### Likely Next Step

- keep using page-by-page closure instead of facade-first expansion
- do not open many shallow pages at once

---

## 5. Signals Product Logic

### Context

Signals are one of the two main product pillars.

This area includes:

- memory snapshots
- published feed
- ranked feed
- high-confidence subset
- watchlist vs discovery split
- user-facing signal page behavior

### Current Point

This area is materially advanced.

The signal domain is no longer only a concept; it already has explicit contracts, derivations, selectors, ranking, and a serious product-facing page.

### Completed Work

- `src/domain/` landed as the redesign landing zone
- signal memory -> published feed mapping exists
- ranked feed exists
- watchlist-first vs market-discovery split exists
- high-confidence subset exists
- bot-consumable feed derivation exists
- read-only and later template-facing surfaces were built
- `Signal Bot` is currently the most mature page in the new flow

### Remaining Work

- final fidelity polish on `Signal Bot`
- richer interactions where justified
- future dedicated signals surfaces if product direction still wants them beyond template flow
- continued reduction of noise and clearer explanation of ranking where useful

### Likely Next Step

- finish treating `Signal Bot` as the quality benchmark for future page closure
- only then move the same level of closure discipline to the next page

---

## 6. Bots Product Logic

### Context

Bots are the second major pillar of the redesign.

Bots must become first-class entities, not just execution side effects of signals.

### Current Point

This area is partially advanced, but not yet closed as a product.

The conceptual/model work is ahead of the fully mature user-facing implementation.

### Completed Work

- bot domain contracts and policy concepts exist
- execution environment and automation mode concepts were formalized
- bot-consumable feed derivation exists
- template-facing `Bot Settings` / control flow exists structurally

### Remaining Work

- finish maturing `Bot Settings` as a truly closed page
- continue bot-first product logic and surface design
- decide when persistence moves from deferred to active
- continue clarifying what end users see vs what admin/technical surfaces keep

### Likely Next Step

- after `Signal Bot` is visually/functionally strong enough, close `Control Panel -> Bot Settings`

---

## 7. Business / Product Model

### Context

This is the area that defines what CRYPE is becoming.

It protects the project from reopening already-settled product questions.

### Current Point

This area is documented and reasonably stable.

The main model is already decided; future work should implement it, not keep renegotiating it.

### Completed Work

- dual `signals + bots + AI` product shape documented
- user modes documented:
  - manual
  - assisted
  - automated
- execution environments documented:
  - paper
  - demo
  - real
- AI role and governance direction documented
- overlap rules and isolation principles documented
- end-user information minimization rules documented

### Remaining Work

- keep future implementation consistent with the model
- continue translating technical architecture into user-facing product behavior
- avoid drifting into “dashboard-only” or “technical tools only” product behavior

### Likely Next Step

- keep using the documented operating model as a non-negotiable reference while closing pages

---

## 8. Documentation / AI Onboarding

### Context

The redesign now depends heavily on clear living documentation.

This is not optional support material; it is part of the operating system for the project.

### Current Point

This area is now much stronger than before, but it must remain actively maintained.

### Completed Work

- redesign docs folder exists
- orchestration docs exist
- style architecture docs exist
- UX architecture docs exist
- business model docs exist
- single-AI onboarding pack now exists
- handoff/work-log process is established

### Remaining Work

- keep docs synchronized with actual code and direction changes
- keep area-level state fresh as the project evolves
- avoid letting docs become stale after page closure rounds

### Likely Next Step

- update this area-status map after meaningful architectural or product rounds

---

## Suggested Use By A New AI

If a new AI enters the project and wants the fastest high-signal context:

1. read `README.md`
2. read this file
3. read `ai-context-pack.md`
4. read `handoff.md`
5. then go to the specific architecture or product document for the area it will touch
