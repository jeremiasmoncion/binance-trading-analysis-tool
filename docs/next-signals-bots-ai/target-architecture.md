# Target Architecture

## Goal

Evolve CRYPE into a coherent operating system for:

- signals
- bots
- AI
- risk/governance
- performance/learning

without throwing away the existing architecture foundation.

## Core Domains

### 1. Market Core

Responsibilities:

- fetch and maintain market context
- compute market snapshots
- produce shared raw opportunity inputs
- supply multi-timeframe and market regime context

### 2. Signal Core

Responsibilities:

- generate global system signals
- classify signals
- separate informative vs operable signals
- publish signal feeds
- expose market-wide and personalized views

Signal Core should support at least:

- watchlist signal feed
- market-wide signal feed
- bot-consumable signal feed
- ranked signal feed

### 3. Bot Core

Responsibilities:

- define explicit bot entities
- enforce bot policies
- consume selected signal feeds
- decide observe / assist / auto behavior
- isolate per-bot capital, positions, orders, and metrics

### 4. AI Core

Responsibilities:

- evaluate signal quality
- classify context
- recommend bot or strategy adjustments
- supervise system health and performance
- support future conversational control

Suggested AI roles:

- analyst AI
- adjuster AI
- supervisor AI

### 5. Risk and Governance Core

Responsibilities:

- define allowed action envelopes
- control overlap
- enforce bot isolation
- constrain AI action authority
- gate real execution more strictly than paper/demo

### 6. Performance and Learning Core

Responsibilities:

- measure outcomes at signal level
- measure outcomes at bot level
- build per-style, per-timeframe, per-coin and per-context metrics
- supply learning snapshots to AI/governance

## Key Structural Separations

The redesign must make these boundaries explicit:

### Signals

- system signal
- user-visible signal
- bot-consumable signal
- execution candidate

### Decisions

- strategy output
- signal classification
- bot decision
- AI recommendation
- governance approval/block
- execution action

### Environments and Modes

Execution environment:

- paper
- demo
- real

Automation mode:

- observe
- assist
- auto

These are orthogonal and must remain independent in the domain model.

## Overlap Model

Default desired behavior:

- multiple bots may observe the same coin
- multiple bots may emit signals on the same coin
- execution overlap on the same coin is restricted by policy by default

Support future policy modes such as:

- strict single-owner execution
- priority-based arbitration
- advanced multi-bot coexistence

## Unrestricted AI Bot

This special bot type may:

- choose strategy behavior more freely
- self-adjust more aggressively
- behave with fewer strategic constraints

But it must still:

- respect technical isolation
- keep separate accounting
- avoid interfering with other bots
- remain inside system integrity guarantees

Its freedom is strategic, not destructive.

## Signals Module Product Shape

The signal module should evolve toward a feed-oriented product with sections such as:

- For You / Watchlists
- Market Opportunities
- By Style
- By Bot Interest
- High-Confidence Signals

The signal ranking layer becomes crucial because market-wide feeds can otherwise become noisy.

## Future Conversational Layer

The architecture should leave room for:

- platform assistant chat
- bot-level chat
- intent -> action translation
- confirmation workflows
- audit trails

This future layer must call structured system actions, not mutate state directly.
