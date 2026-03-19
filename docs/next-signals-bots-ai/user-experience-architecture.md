# User Experience Architecture

## Purpose

This document translates the product redesign into a user-facing page structure.

It exists to prevent the project from continuing to grow inside the legacy `Signal Bot` view as one large mixed page.

The reference UX direction is the local `TradeBotX` template, especially:

- `tradebotx/tradebotx/src/overview.html`
- `tradebotx/tradebotx/src/signal-bot.html`
- `tradebotx/tradebotx/src/bot-settings.html`
- `tradebotx/tradebotx/src/partials/sidebar.html`

The template is not meant to be copied literally.

It is meant to define:

- page distribution
- navigation hierarchy
- where cards, tabs, lists, tables, and charts belong
- what should be visible to a normal end user versus an admin/operator

## Core UX Rule

The old `Signal Bot` page should no longer be treated as the long-term visual home for the redesign.

That page may remain temporarily in code, but the future experience should be built as a new, clearer product surface.

In practice:

- do not keep extending the old page as the final product
- do not hide major new work inside buried internal sections
- do design around dedicated pages and subpages
- do follow the template's stronger layout hierarchy and navigation model

## User Types

### End User

The end user should see:

- the most important signals
- the bots they own or use
- simple performance summaries
- key actions
- a clear explanation of what is working

The end user should not be forced to consume:

- low-level runtime diagnostics
- raw strategy-engine internals
- dense execution payloads
- verbose policy objects
- technical memory/governance data unless translated into simple product language

### Admin / Technical Operator

Admin users may later get a separate technical surface for:

- runtime diagnostics
- advanced governance
- experimental bot policies
- raw explainability
- execution internals
- deeper strategy and validation tooling

That surface is not the primary end-user experience.

## Information Translation Rule

When a metric is too technical, prefer translating it into a simpler user-facing concept.

Examples:

- signal pass/fail ratio -> `efficiency`
- dense ranking metadata -> `confidence` or `why this is prioritized`
- multiple policy checks -> `fits this bot` / `blocked by bot rules`
- raw execution gating -> `ready to act` / `not ready yet`

Do not expose technical wording unless the module truly requires it.

## Target Navigation Structure

The intended CRYPE structure should move toward this:

### Main

- `Dashboard`
- `My Wallet`
- `My Statistics`

### Trading & Bots

- `Signals`
- `Bots`
- `Trading`
- `Control Panel`

### Later / Advanced

- `AI Insights`
- `Execution Logs`
- `Admin Runtime`

The exact labels can evolve, but the important thing is that signals and bots become distinct first-class destinations.

## Target Page Architecture

## 1. Signals

This should become the new home for the user-facing signals product.

Suggested subpages or tabs:

- `Overview`
- `Watchlist`
- `Market Discovery`
- `High Confidence`
- `History`

### Signals Overview

Purpose:

- show the best current signals without overwhelming the user

Recommended blocks:

- top quick stats
- prioritized signal cards
- short watchlist-first lane
- short market-discovery lane
- high-confidence section
- compact explanation of why signals were promoted or demoted

Recommended UI patterns:

- cards for active/prioritized signals
- filter chips for lanes or confidence level
- a small number of compact stat cards
- short explanatory text, not dense technical tables

### Watchlist

Purpose:

- show signals that matter directly to the user's chosen universe

Recommended UI patterns:

- signal cards or compact rows
- watchlist filters
- status pills
- easy manual actions

### Market Discovery

Purpose:

- show the best opportunities outside the watchlist

Recommended UI patterns:

- cards or ranked list
- stronger pruning than watchlist
- explicit rationale tags

### High Confidence

Purpose:

- show the smallest, cleanest subset

Recommended UI patterns:

- premium-feeling cards
- short rationale
- very little noise

### History

Purpose:

- show past signals and outcomes

Recommended UI patterns:

- table or dense list
- filters
- pagination

## 2. Bots

This should become the new home for bot management as a product surface.

Suggested subpages or tabs:

- `All Bots`
- `Create Bot`
- `Performance`
- `History`

### All Bots

Purpose:

- give the user a clear overview of all bots

Recommended blocks:

- stats overview
- search
- status chips
- grid of bot cards
- optional table toggle later

Recommended bot card content:

- bot name
- style or strategy
- environment
- status
- short performance summary
- capital allocation
- one primary action
- one settings/detail action

This page should feel very close to the template's `bot-settings.html`.

### Create Bot

Purpose:

- provide a clear, guided creation flow

Recommended UI patterns:

- drawer or dedicated page
- simple mode first
- advanced mode after

The default experience should ask for only the essentials:

- bot name
- universe source
- dominant style
- execution environment
- automation mode
- capital allocation

Everything else should be secondary or advanced.

### Bot Detail

Each bot should later have its own detail surface.

Recommended sections:

- overview
- signals this bot can consume
- current policy summary
- performance
- recent actions
- why it acted / did not act

The user should not be hit immediately with raw policy JSON or deep technical state.

## 3. Dashboard

Dashboard should remain the top-level command center, not the place where all signals/bots detail lives.

It should summarize:

- capital
- active bots
- top opportunities
- health
- quick jumps into Signals and Bots

It should not absorb the full signals module again.

## Minimal End-User Information Rule

For end users, the minimum useful information is:

### On signals

- pair
- direction
- confidence
- why it matters
- whether it is watchlist or discovery
- whether it is actionable

### On bots

- name
- status
- mode
- environment
- high-level performance
- high-level activity
- one-line summary of what the bot is doing

Everything more technical should either:

- be hidden
- be collapsed
- or be translated into plain language

## Component Guidance

### Use cards when:

- the item is an active entity
- it needs status, summary, and actions
- it should feel operational and scannable

Good examples:

- signals
- bots
- top opportunities
- high-confidence items

### Use charts when:

- the user is trying to understand trend/performance over time

Good examples:

- bot performance
- signal performance
- capital curve

### Use tables when:

- the user needs history, logs, or dense comparison

Good examples:

- signal history
- bot history
- execution history

### Use plain text summaries when:

- the technical concept is too dense and needs product translation

Good examples:

- confidence rationale
- ranking reason
- why a bot is blocked

## Immediate Implementation Consequence

The next implementation work should stop treating the current `Signal Bot` page as the future product home.

Instead, the next UI step should be:

1. define the new user-facing `Signals` and `Bots` surfaces
2. expose them clearly in navigation
3. move the new domain-driven signals experience into that new structure
4. keep the legacy `Signal Bot` page out of the main user flow once the replacement exists

## Next Big UX Milestone

Replace the legacy `Signal Bot` experience with:

- a dedicated `Signals` page
- a dedicated `Bots` page
- a bot-list-first experience
- a signal-list-first experience
- end-user-friendly summaries
- technical depth either simplified or deferred to admin surfaces
