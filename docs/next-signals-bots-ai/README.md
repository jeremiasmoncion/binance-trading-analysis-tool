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

## Suggested Reading Order

1. [current-state.md](./current-state.md)
2. [target-architecture.md](./target-architecture.md)
3. [domain-model.md](./domain-model.md)
4. [implementation-plan.md](./implementation-plan.md)
5. [work-log.md](./work-log.md)
6. [handoff.md](./handoff.md)
