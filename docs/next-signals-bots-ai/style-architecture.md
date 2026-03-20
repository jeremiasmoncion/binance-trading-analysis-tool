# Style Architecture

## Purpose

This document explains how CRYPE should implement the visual system of the app.

It exists to prevent future contributors from:

- copying raw template CSS patterns directly
- introducing isolated one-off styles
- breaking the global style architecture already established in CRYPE
- matching the template flow while drifting away from the intended visual fidelity

## Core Rule

CRYPE must look as literal as possible to the `TradeBotX` template, but it must be implemented using CRYPE's shared style architecture.

That means:

- literal visual result
- disciplined implementation

Not:

- approximate visual result
- or literal template code copy-paste

## Reference Sources

### Visual target reference

The visual target comes from the local `TradeBotX` template, especially:

- `tradebotx/tradebotx/src/overview.html`
- `tradebotx/tradebotx/src/signal-bot.html`
- `tradebotx/tradebotx/src/bot-settings.html`
- `tradebotx/tradebotx/src/execution-logs.html`
- `tradebotx/tradebotx/src/trading.html`
- `tradebotx/tradebotx/src/partials/sidebar.html`

### Implementation reference

The correct CRYPE implementation reference is:

- `src/views/DashboardView.tsx`
- `src/views/BalanceView.tsx`

These pages show how to achieve template-faithful visuals using:

- shared theme tokens
- global classes
- reusable panel/card/button patterns
- centralized CSS organization

## Implementation Rules

### 1. Match the template visually

The target is to match:

- spacing
- proportions
- hierarchy
- rhythm
- card density
- button treatment
- tab/chip styling
- side panel balance
- lower supporting blocks
- typography scale
- visual grouping

### 2. Do not copy the template's style implementation literally

Avoid:

- dumping template CSS directly into the project
- inline hacks to imitate the template quickly
- repeating near-identical classes for each page
- page-local style systems that bypass the shared architecture

### 3. Prefer CRYPE shared style primitives

Prefer:

- global tokens
- shared panel classes
- shared action/button classes
- shared card patterns
- shared layout grids
- reusable utility-level patterns already present in the app

### 4. Extend shared architecture when needed

If a template surface needs a new visual pattern:

- add it as a reusable CRYPE pattern
- do not trap it inside one page if it will clearly recur

Examples:

- stats row pattern
- tab strip pattern
- card grid pattern
- side stack pattern
- empty-state pattern
- account/user block pattern

## Visual Fidelity Checklist

Before declaring a page visually ready, check:

- does the page read like the template at first glance
- do card sizes and spacing feel equivalent
- do tabs/chips feel equivalent
- does the page density match the template
- does the side panel balance match the template
- do buttons and controls feel like the same product family
- does the page still feel visually coherent with CRYPE `Dashboard` and `My Wallet`

If the answer is "structure is similar but styling feels different", the page is not ready.

## Approved Visual Baseline

The CRYPE live visual baseline already exists in:

- `Dashboard`
- `My Wallet`

Future pages should inherit from that implementation style while aiming at template-level visual fidelity.

Specific enforcement for future AI contributors:

- `Signal Bot` should be implemented using the same visual discipline already present in `My Wallet`
- do not treat `Signal Bot` as a place to invent a parallel card system, tab system, or typography rhythm
- prefer existing shared primitives such as:
  - `ui-summary-card`
  - `ui-chip`
  - `ui-button`
  - `ui-toolbar`
  - CRYPE dark panel tokens
- if `Signal Bot` still looks noticeably different from `My Wallet` in spacing, density, contrast, or typography, it is not visually closed yet

In short:

- template defines the look target
- CRYPE defines the implementation discipline

## Page-Level Style Priorities

### Signal Bot

Must especially match:

- stats row
- tab strip
- filter chip row
- active signal card density
- confidence bar treatment
- lower insight/support blocks

### Bot Settings

Must especially match:

- upper stats
- secondary tab strip
- card/list density
- settings panel composition
- drawer/edit affordance

### Execution Logs

Must especially match:

- top stats
- filter rail
- table density
- record/status badges
- action-cell treatment

### Sidebar

Must especially match:

- group order
- parent/child menu rhythm
- `ACCOUNT` zone
- bottom user block

## What Future AI Contributors Should Assume

- visual fidelity is a first-class requirement, not polish
- style discipline is also a first-class requirement, not optional refactor work
- a page is not finished just because the layout is structurally correct
- a page is not finished if it looks correct but is implemented with isolated style debt
