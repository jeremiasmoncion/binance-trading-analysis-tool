# Current State

## Summary

CRYPE already contains a meaningful operational pipeline. The current platform is not starting from zero.

Today the system can:

- read market data
- generate heuristic strategy candidates
- rank strategies
- save signals
- evaluate pending signals
- scan watchlists automatically
- execute demo orders with guardrails
- persist execution and learning snapshots
- adapt strategy governance using historical outcomes

## Main Existing Building Blocks

### Frontend

- `src/App.tsx`
  - synchronization boundary
  - auth bootstrap
  - market/system plane sync
  - startup flow
  - realtime bridge
- `src/data-platform/*`
  - shared market and system planes
  - selectors
  - no-op-aware sync
- `src/hooks/useMarketData.ts`
  - market fetch/live refresh
  - signal and strategy candidate generation in frontend
- `src/hooks/useSignalMemory.ts`
  - signal persistence
  - duplicate protection
  - pending signal evaluation
- `src/hooks/useMemoryRuntime.ts`
  - strategy engine runtime
  - scanner runtime
- `src/hooks/useValidationLabRuntime.ts`
  - validation and backtesting runtime
- `src/hooks/useWatchlist.ts`
  - watchlist hydration
  - local cache + remote persistence

### Strategies and Market Logic

- `src/strategies/trendAlignmentV1.ts`
- `src/strategies/trendAlignmentV2.ts`
- `src/strategies/breakoutV1.ts`
- `src/strategies/index.ts`
- `src/lib/trading.ts`

Current strategy generation is still heuristic and threshold-based. It uses:

- SMA20 / SMA50
- RSI
- support/resistance
- ATR-derived volatility
- multi-timeframe alignment
- volume ratio

### Backend / Server Logic

- `api/_lib/marketRuntime.js`
  - backend signal generation mirror
  - strategy candidate construction
  - operation plan generation
- `api/_lib/signals.js`
  - signal persistence
  - duplicate detection
  - pending signal closure
  - feature snapshot persistence
- `api/_lib/executionEngine.js`
  - candidate building
  - eligibility filtering
  - demo execution
  - protection handling
  - execution sync
- `api/_lib/watchlistScanner.js`
  - watchlist scanning
  - auto-signal creation
  - possible auto-execution
- `api/_lib/strategyEngine.js`
  - active strategy resolution
  - experiments
  - adaptive promotions
  - scorer policy
  - context bias
  - feature model evaluation

## What The Current System Is Good At

- explicit system contracts
- shared app state
- signal persistence
- execution guardrails
- operational overlays
- adaptive governance concepts
- scanner/runtime orchestration
- historical learning snapshots

## Current Limitations

### 1. Signals Are Still Born From Heuristics

The primary signal engine is still handcrafted and threshold-driven.

That means the system is better at:

- filtering
- ranking
- governing
- blocking risky actions

than at creating superior edge from a modern signal generation perspective.

### 2. Bots Are Not Yet First-Class Entities

The system has automation, scanner behavior, and demo execution, but not yet a clean explicit domain model for:

- bot identity
- bot policy
- bot memory
- bot universe
- bot overlap policy
- bot-level AI policy
- bot-level accounting isolation

### 3. Signals and Bots Are Still Too Intertwined

The project can save and act on signals, but it still needs a stronger separation between:

- global system signals
- user-facing manual signals
- signals consumed by bots
- bot decisions
- execution candidates

### 4. AI Exists More As Governance Than As Product Interface

There is already adaptive logic in strategy governance, but CRYPE still lacks:

- explicit AI product roles
- bot-specific AI policies
- platform-level AI assistant structure
- conversational control layer

### 5. Documentation and Handoff Need To Become First-Class

The codebase contains valuable architecture docs, but this specific redesign needs its own living documentation set.

## Reuse Recommendation

The following areas should be evolved, not discarded:

- data planes
- signal memory
- execution engine
- watchlist scanner
- strategy engine adaptive governance
- performance snapshots

The following areas need a stronger conceptual redesign:

- bot domain model
- signal feed taxonomy
- AI role model
- memory model
- overlap policy
- product-facing signal module
