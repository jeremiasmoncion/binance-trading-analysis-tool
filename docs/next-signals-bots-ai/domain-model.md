# Domain Model

## Overview

This document captures the target domain language for the redesign. It is intentionally product-facing and implementation-facing at the same time.

## Core Entities

### Bot

A bot is a first-class operating entity with:

- identity
- policy
- execution environment
- automation mode
- capital assignment
- universe
- memory
- performance
- audit trail

Suggested attributes:

- `id`
- `name`
- `description`
- `status`
- `executionEnvironment`
- `automationMode`
- `allocatedCapital`
- `universePolicy`
- `stylePolicy`
- `timeframePolicy`
- `strategyPolicy`
- `aiPolicy`
- `riskPolicy`
- `executionPolicy`
- `overlapPolicy`
- `memoryPolicy`
- `priority`
- `createdAt`
- `updatedAt`

The implementation should also support:

- quick-edit workspace settings
- full bot workspace state
- local / family / global memory separation
- future decision and conversation audit trails

### Bot Universe Policy

Must support:

- watchlist-backed universe
- bot-owned list
- future hybrid universe

Suggested kinds:

- `watchlist`
- `custom-list`
- `hybrid`
- `market-filter`

### Bot Style Policy

Must support:

- scalping
- swing
- long

Suggested shape:

- `dominantStyle`
- `allowedStyles`
- `multiStyleEnabled`

### Bot Risk Policy

Suggested concerns:

- max position size
- max open positions
- max daily loss
- max drawdown
- cooldown rules
- symbol concentration
- style concentration
- real-environment restrictions

### Bot Execution Policy

Suggested concerns:

- whether the bot can open positions
- whether it can only suggest
- whether approval is required
- whether real execution is enabled
- whether auto execution is enabled

### Bot AI Policy

Suggested concerns:

- whether analyst AI is enabled
- whether adjuster AI is enabled
- whether supervisor AI can alter behavior
- whether unrestricted mode is enabled
- what actions require confirmation

### Overlap Policy

Suggested concerns:

- coin observation overlap
- signal overlap
- execution overlap
- arbitration priority
- exclusive universe mode

### Signal

This redesign should distinguish multiple signal layers.

Suggested taxonomy:

- `system signal`
- `classified signal`
- `published signal`
- `bot-consumable signal`
- `execution candidate`

Additional product labels should remain possible for the user-facing module:

- informational
- observational
- operable
- AI-prioritized

### Signal Feed

Suggested feed kinds:

- `watchlist`
- `market-wide`
- `bot-specific`
- `high-confidence`
- `style-specific`

### Memory

Three target layers:

#### Bot local memory

- decisions
- consumed signals
- outcomes
- adjustments
- failures
- runtime context

#### Family shared memory

- style-level patterns
- strategy-level patterns
- optional shared learning

#### Global memory

- performance aggregates
- market context tendencies
- scorer history
- governance history

### Performance Summary

Should support summaries for:

- signal
- bot
- strategy
- style
- timeframe
- coin
- context
- origin

### Bot Decision Record

The next structural entity after the persisted bot registry should be a dedicated bot decision record.

Minimum attributes:

- `id`
- `botId`
- `signalSnapshotId`
- `symbol`
- `timeframe`
- `signalLayer`
- `action`
- `status`
- `source`
- `rationale`
- `executionEnvironment`
- `automationMode`
- `marketContextSignature`
- `contextTags`
- `metadata`
- `createdAt`
- `updatedAt`

This is the entity that should later power:

- bot history
- execution logs
- bot-specific performance
- learning snapshots
- conversational audit trails

The current operational progression inside `BotDecisionRecord.metadata` also now supports a governed execution-intent lane for non-real dispatch:

- `executionIntentStatus`
- `executionIntentLane`
- `executionIntentLaneStatus`

Current lane-state progression in the implementation:

- `awaiting-approval`
- `queued`
- `dispatch-requested`
- `previewed`
- `preview-recorded`
- `execution-submitted`
- `blocked`
- `linked`

This allows the bot to move from signal consumption to paper/demo dispatch without pretending that a real order was already emitted.

## Future Conversational Entities

The architecture should leave room for:

- assistant thread
- bot thread
- intent
- action proposal
- approval record
- execution receipt
- audit event

The preferred future flow is:

1. the user expresses an intention
2. AI interprets it
3. the system turns it into a structured action
4. governance validates permissions
5. confirmation is requested when needed
6. the system executes the formal action
7. the result is stored in audit history
