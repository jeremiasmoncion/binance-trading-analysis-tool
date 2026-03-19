# User Experience Architecture

## Purpose

This document defines the official user-facing navigation, page hierarchy, and visual flow for the CRYPE redesign.

Its purpose is to stop future implementation rounds from:

- growing the legacy `Signal Bot` page further
- inventing alternate navigation trees
- creating page layouts that only feel "inspired by" the template
- exposing technical internals directly to end users without translation

This document is now the operational source of truth for UX architecture.

## Reference Standard

The local `TradeBotX` template is no longer just inspiration.

It is the explicit reference standard for:

- sidebar hierarchy
- page grouping
- submenu structure
- top-of-page layout
- use of quick stat cards
- use of tabs
- use of search, chips, filters, and toggles
- use of cards vs tables vs forms vs drawers
- visual rhythm and interaction flow

Primary reference files:

- `tradebotx/tradebotx/src/partials/sidebar.html`
- `tradebotx/tradebotx/src/overview.html`
- `tradebotx/tradebotx/src/signal-bot.html`
- `tradebotx/tradebotx/src/bot-settings.html`
- `tradebotx/tradebotx/src/execution-logs.html`
- `tradebotx/tradebotx/src/trading.html`

The rule is now:

- CRYPE should match the template flow as closely as possible
- deviations must be intentional, documented, and product-justified
- "similar" is not enough when the template already defines the correct UX pattern

## Graphic Line Rule

CRYPE already has a newer visual line established in the migrated:

- `Dashboard`
- `My Wallet`

That graphic line should remain the visual baseline for the live app.

This means the project must simultaneously preserve two things:

- the exact template UX structure and navigation flow
- the already-migrated CRYPE theme system, shared CSS architecture, and global style inheritance

Practical consequence:

- match the template's flow and hierarchy exactly
- do not introduce a second visual language
- reuse the existing global style system and theme tokens
- keep new pages visually coherent with the current CRYPE dashboard/wallet implementation

## Style Implementation Rule

Matching the template does not mean reproducing its CSS implementation style literally.

The requirement is:

- visual result should match the template as closely as possible
- implementation should follow CRYPE's style architecture and good practices

That means:

- use global/shared classes
- use theme tokens and reusable patterns
- avoid isolated one-off styling when a shared pattern should exist
- avoid template-style hardcoded styling shortcuts that bypass the project's style architecture

The implementation reference pages for this rule are:

- `My Wallet`
- `Dashboard`

These pages are the model for how to achieve template-level visuals with cleaner project-level CSS architecture.

Future UI work should treat them as the implementation reference, not just as visual inspiration.

## Core UX Rule

The legacy `Signal Bot` page is no longer the future home of signals and bots.

It may remain in code temporarily, but it should not continue as:

- the main delivery target
- the main navigation destination
- the default place to mount new product UX

The redesign should replace the old end-user flow, not extend it forever.

## End-User First Rule

Every new UI round must be judged as an end-user experience, not as an internal lab.

This means:

- new functionality must be reachable from a realistic user path
- major surfaces should not be buried in hidden host pages
- page naming, tab naming, and block grouping should make sense to a normal user
- the interface should expose the minimum useful information first

If a concept is too technical, the UI should either:

- translate it into simpler product language
- hide it from the main user surface
- or defer it to a future admin/technical surface

## User Information Policy

### End User should see

- key signal opportunities
- active and pending bot status
- simplified performance
- clear next actions
- confidence, efficiency, and health in simple language
- clear segmentation between overview, settings, history, and active opportunities

### End User should not see by default

- runtime internals
- raw governance objects
- dense strategy-engine diagnostics
- unfiltered execution payloads
- technical ranking metadata in raw form
- debug-style memory snapshots

### Admin / Technical surfaces may later contain

- deep runtime diagnostics
- advanced AI/gov policy controls
- detailed explainability
- raw execution reasoning
- validation and experiments

That is not the main user journey.

## Translation Rule

Technical concepts must be translated whenever possible.

Examples:

- pass/fail ratio -> `efficiency`
- ranking internals -> `confidence` or `why this appears first`
- policy checks -> `fits this bot` / `blocked by bot rules`
- execution gating -> `ready` / `waiting`
- noisy strategy metrics -> short status summaries or health badges

Do not overload the end-user surface with implementation language.

## Official Sidebar Architecture

The sidebar should follow the template hierarchy and ordering.

### MAIN

- `Dashboard`
  - `Dashboard`
- `My Wallet`
- `My Statistics`

### TRADING & BOTS

- `Trading`
- `Control Panel`
  - `Overview`
  - `Bot Settings`
  - `Execution Logs`
- `AI Bot`
  - `Signal Bot`
  - `DCA Bot`
  - `Arbitrage Bot`
  - `Pump Screener`

### DEFI & PORTFOLIO

- `DeFi Center`
- `Yield Farming`
- `Staking Pools`
- `Liquidity Tracker`
- `Portfolio Tracker`
- `Wallets`
- `DeFi Protocols`

### MARKETPLACE

- `Strategies Marketplace`

### ACCOUNT

- `Preferences`
- `Notifications`
- `Security & API Keys`
- `Invite Friends`
- `Subscription`
- `Help Center`

### Bottom User Block

The sidebar should end with a persistent user block at the bottom, matching the template pattern.

This block should contain:

- user avatar
- display name
- secondary identity text such as email or role label
- user/account access entry point

Important rule:

- logout should not appear as an isolated loose button outside the sidebar architecture
- logout should live inside the user/account area or as part of the account-related flow
- the lower sidebar should feel like one integrated account zone, not disconnected fragments

Notes:

- labels can be localized, but hierarchy and flow should remain equivalent
- sidebar group order should match the template
- submenu behavior should match the template pattern
- icon usage should mirror the template's intent and placement
- the lower `ACCOUNT` section and bottom user block are part of the official flow, not optional extras

## Page Flow Architecture

## 1. Dashboard

This should continue following the already-migrated CRYPE line while preserving the template structure:

- page title and subtitle
- primary CTA area on top right
- quick stat cards
- tabbed chart/content region
- right-side summary/support cards where applicable

This page is already among the closest to the intended direction.

## 2. My Wallet

This page should also remain aligned with the already-migrated CRYPE style line and continue matching the template's strong block hierarchy:

- header
- summary cards
- main holdings/performance surface
- supporting context blocks

## 3. Trading

Trading should follow the template's structure closely:

- stat cards at the top
- chart-heavy main area
- order-entry surface to the right
- lower market/order-book sections

This is an operational page and may remain richer than Signals/Bots, but it should still respect the same visual rhythm.

## 4. Control Panel

This is the main operational management area for bots.

It should contain the template-equivalent subpages:

- `Overview`
- `Bot Settings`
- `Execution Logs`

### 4.1 Overview

Purpose:

- give a control-center summary for the user's bot operation

Expected structure:

- page hero/header
- quick stats row
- chart/performance block
- balance/context/support block
- active bots list or cards
- optional AI insights side block

### 4.2 Bot Settings

Purpose:

- manage bots with a strong template-matching flow

Expected structure:

- top header with CTA
- top stat cards
- secondary tab strip:
  - `All Bots`
  - `General Settings`
  - `Risk Management`
  - `Notifications`
  - `API Connections`

#### All Bots

Expected UX:

- search bar
- status chips
- grid/list toggle
- bot cards
- per-card primary action
- per-card settings action
- right drawer for editing bot settings

This page is the main reference for how bot management should feel.

#### General Settings

Expected UX:

- left form blocks
- right toggle/settings blocks
- bottom settings sections
- save/reset action row

#### Risk Management

Expected UX:

- large settings panels
- grouped global risk controls
- grouped stop-loss / take-profit controls
- grouped emergency actions

#### Notifications

Expected UX:

- notification channels panel
- alert types panel
- save/reset controls

#### API Connections

Expected UX:

- connected exchange cards
- add-exchange card
- security best-practice cards

## 5. AI Bot Group

This group should match the template structure and naming flow.

It should contain:

- `Signal Bot`
- `DCA Bot`
- `Arbitrage Bot`
- `Pump Screener`

### Signal Bot

This is the new home of the signals product experience.

It should follow the template's structure:

- top stat cards
- upper tab strip:
  - `Active Signals`
  - `Signal History`
  - `Performance`
  - `Bot Settings`
- filter chips below
- signal card grid
- lower supporting insight blocks

Expected lower blocks:

- `Market Sentiment`
- `AI Insights`
- `Top Signal Performers`

Signals should not be hidden in generic lab surfaces anymore.

### DCA Bot / Arbitrage Bot / Pump Screener

These should eventually follow the same high-level pattern:

- summary metrics
- strategy-specific active opportunities or bot cards
- clear tabs
- targeted settings
- simplified explanatory blocks

## Page Composition Rules

### Use cards when

- showing active opportunities
- showing bot summaries
- showing quick stats
- showing lightweight explainability
- showing grouped settings summaries

### Use tables when

- showing logs
- showing long histories
- showing audit-style records
- showing dense chronological data

### Use charts when

- trend over time matters
- performance progression matters
- context is easier to read visually than in text

### Use text summaries when

- translating technical internals into user language
- introducing the purpose of a page or section
- explaining why a signal or bot is highlighted

### Use drawers when

- editing a bot from a grid/list without leaving context
- performing contextual settings edits

This is explicitly supported by the template and should be reused.

## What Should Be Hidden From End Users For Now

The following should remain out of the main end-user flow unless productized first:

- raw signal ranking internals
- domain-only lab surfaces
- registry scaffolding details
- internal runtime/debug surfaces
- deep bot memory objects
- raw policy objects
- raw execution-candidate payloads

## Implementation Mandates

### For the Implementer

- do not keep expanding the old `Signal Bot` page as the future UX
- implement page and submenu flow to match the template hierarchy
- preserve the CRYPE theme/style system while matching template structure
- use `My Wallet` and `Dashboard` as the implementation reference for how to build template-faithful visuals with the project's shared CSS architecture
- think first in terms of:
  - page
  - subpage
  - tab
  - card/table/chart/form choice
- decide what an end user truly needs to see first
- move technical detail either behind translation or out of the main surface

### For the Refiner

- protect runtime and shared state while the new page architecture is mounted
- prevent new surfaces from introducing polling, churn, equivalent writes, or duplicated live paths
- support page growth through stable shared seams, not page-local hacks

## Current Big UX Goal

Replace the legacy user flow around `Signal Bot` with a full template-matching product flow where:

- navigation is exact and predictable
- signals live under the correct AI Bot structure
- bot management lives under the correct Control Panel structure
- the live app keeps the cleaner CRYPE graphic line already established in Dashboard and My Wallet
- technical complexity stays behind the user-facing experience instead of leaking into it
