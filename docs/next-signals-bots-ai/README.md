# CRYPE Signals + Bots + AI

## Purpose

This documentation area tracks the redesign of CRYPE into a dual platform for:

- global trading signals
- configurable bots
- controlled AI assistance
- risk/governance
- performance and learning

It exists so future contributors and AI agents can understand:

- what the project already does
- what we are changing
- why we are changing it
- what has been completed
- what remains to be implemented

## Why This Redesign Exists

CRYPE already has meaningful infrastructure for:

- market analysis
- signal memory
- execution filtering
- watchlist scanning
- adaptive strategy governance

But the current system is still stronger at filtering and governing signals than at generating truly strong signal edge.

The next step is to evolve CRYPE into a platform where:

- the system can emit signals as a standalone product
- bots become real first-class operating entities
- AI participates deeply, but inside policy limits
- performance data feeds learning and governance
- future conversational control becomes possible

## Product Direction

CRYPE should evolve as a type C product:

- a signals platform
- a bots platform
- both sharing one market/intelligence core

The system should support:

- manual use
- assisted use
- automated use
- multiple bots at the same time
- global market signals
- personalized signals
- rich performance measurement

## Non-Negotiable Decisions

- CRYPE remains a dual `signals + bots` platform.
- AI should be deeply integrated, but controlled by policies and guardrails.
- A special `unrestricted AI bot` may exist, but it must remain isolated from other bots at the accounting and execution levels.
- Bots must support both `watchlist-driven universes` and `bot-owned universes`.
- The model must support `paper`, `demo`, and `real` execution environments.
- The model must support `observe`, `assist`, and `auto` automation modes.
- The general signals module should include both `watchlist` and `market-wide` signals.
- Work must proceed by phases with stable, functional deliverables.
- The user-facing navigation flow should follow the `TradeBotX` template hierarchy exactly unless a deviation is documented and justified.
- The migrated CRYPE visual line already present in `Dashboard` and `My Wallet` remains the live visual baseline.
- End-user surfaces should prefer minimum useful information and translate technical detail into simpler product language whenever possible.

## Suggested Reading Order

1. [current-state.md](./current-state.md)
2. [area-status.md](./area-status.md)
3. [product-operating-model.md](./product-operating-model.md)
4. [target-architecture.md](./target-architecture.md)
5. [domain-model.md](./domain-model.md)
6. [style-architecture.md](./style-architecture.md)
7. [user-experience-architecture.md](./user-experience-architecture.md)
8. [implementation-plan.md](./implementation-plan.md)
9. [ai-context-pack.md](./ai-context-pack.md)
10. [work-log.md](./work-log.md)
11. [handoff.md](./handoff.md)

## Active Bot Core Working Directive

The active implementation directive for the current CRYPE round is:

- continue on `main`
- resume specifically from the current `Bot Core` state
- do not rebuild CRYPE from zero
- do not open a parallel architecture
- do not introduce screen-local fetch paths when a shared seam already exists
- do not introduce feature-local polling loops
- do not solve runtime/data stability inside visual components
- do not hide architectural issues behind defensive local memoization
- implement by phases with:
  - traceability
  - updated documentation
  - functional deliverables

Task close-out rule for future contributors:

- when a task or subphase is completed, do not stop at the code change alone
- update the corresponding documentation and handoff notes
- if the task changed the application, validate that:
  - the code still passes validation
  - the build still passes
  - the application still runs and behaves correctly
- if validation is successful, save the work properly in `main` and push the milestone when ready
- explain clearly to the user what was done
- keep the response concise instead of overly abundant
- prefer two short summaries:
  - a simple user-facing summary
  - a short technical summary
- explain any important validation, limitation, or risk
- always end by stating the next recommended step
- only provide the production review link when:
  - the user explicitly asks for browser review
  - or the change is primarily visual and browser review is part of acceptance
- the canonical public review URL is:
  - `https://binance-trading-analysis-tool.vercel.app`

Mandatory documentation source of truth before further `Bot Core` work:

- this folder `docs/next-signals-bots-ai/`
- `docs/data-architecture.md`
- `docs/realtime-core-service.md`
- `docs/orchestration/README.md`
- `docs/orchestration/workflow.md`

Current implementation priority:

1. review the real current `Bot Core` state
2. map what is already real vs partial / placeholder
3. deepen the bot entity into a real operating entity
4. continue in disciplined phases without breaking the current system

Current `Bot Core` focus areas:

- real bot identity
- real bot policies
- bot memory
- bot activity/history
- bot-owned performance
- missing persisted settings
- stronger bridge between consumed signals and bot decisions

`Signal Core` should be treated as already sufficiently separated for this round and should not be rebuilt unless a real structural problem is discovered.
