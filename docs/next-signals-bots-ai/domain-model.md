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

## Future Conversational Entities

The architecture should leave room for:

- assistant thread
- bot thread
- intent
- action proposal
- approval record
- execution receipt
- audit event
