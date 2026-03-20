# AI Context Pack

## Purpose

This document is the fast onboarding pack for a new AI thread that must work across the whole CRYPE redesign.

It is especially useful when:

- there is only one AI thread
- a new AI takes over after another thread
- a director wants to bootstrap a new worker quickly

## Read This First

Recommended reading order:

1. `docs/next-signals-bots-ai/README.md`
2. `docs/data-architecture.md`
3. `docs/realtime-core-service.md`
4. `docs/next-signals-bots-ai/style-architecture.md`
5. `docs/next-signals-bots-ai/user-experience-architecture.md`
6. `docs/next-signals-bots-ai/product-operating-model.md`
7. `docs/next-signals-bots-ai/target-architecture.md`
8. `docs/next-signals-bots-ai/domain-model.md`
9. `docs/next-signals-bots-ai/implementation-plan.md`
10. `docs/next-signals-bots-ai/handoff.md`
11. `docs/next-signals-bots-ai/work-log.md`

## Current Truths

### Architecture

- CRYPE already has a meaningful shared data architecture.
- The hot path is being migrated toward `snapshot + overlays + selectors + shared actions`.
- New pages should not invent their own fetch model.
- Realtime and shared runtime stability matter as much as feature delivery.

### UX

- The app must follow the `TradeBotX` template flow exactly.
- The app must also preserve CRYPE's shared style architecture.
- `Dashboard` and `My Wallet` are the implementation reference pages.
- A page is not done if it is only structurally similar to the template.
- User-facing naming should also follow the template by default.

### Product

- CRYPE is a dual `signals + bots + AI` platform.
- Signals and bots are separate user-facing products on top of a shared market/intelligence core.
- Bots are first-class operating entities.
- AI is controlled by policy and governance, not freeform mutation.

## Working Rules

### If you are touching product/UI

- think like an end-user product builder
- use the template as the literal UX target
- use CRYPE style architecture for implementation
- simplify technical language where possible

### If you are touching architecture/runtime

- think like a shared-systems engineer
- reduce churn
- prefer selectors and shared seams
- avoid page-local compensation logic
- keep shared comparators/derivations centralized

## Preferred Delivery Method

Work by meaningful slices, not uncontrolled rewrites.

Best pattern:

1. choose one page or one architectural seam
2. improve it to a clearly better state
3. update docs
4. leave clear handoff

## Minimum Documentation Update Rule

Any meaningful round should update at least:

- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`

If architecture or phase direction changed, also update:

- `docs/next-signals-bots-ai/implementation-plan.md`
- `docs/next-signals-bots-ai/user-experience-architecture.md`
- `docs/next-signals-bots-ai/style-architecture.md`
- `docs/orchestration/phase-status.md`

## What Not To Do

- do not reopen already settled product decisions casually
- do not treat the template as loose inspiration
- do not solve shared-state issues from page-local hacks
- do not hide major user-facing work in buried labs and call it complete
- do not overload the user with internal diagnostics

## Current Major Milestones

- shared data/runtime architecture exists and continues to be hardened
- explicit domain layer for signals/bots exists
- template-flow migration is in progress
- `Signal Bot` is the current focal page for high-fidelity closure

## Current Likely Next Steps

Depending on the phase:

- close `Signal Bot` to literal visual/functional fidelity
- close `Bot Settings`
- close `Execution Logs`
- continue runtime/shared selector refinement

## One-Line Summary

If you are a new AI entering this project, your job is to build CRYPE into a template-faithful, style-disciplined, data-architected `signals + bots + AI` product without breaking the runtime foundation.
