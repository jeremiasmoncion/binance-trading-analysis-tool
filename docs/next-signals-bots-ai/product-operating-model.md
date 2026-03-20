# Product Operating Model

## Purpose

This document captures the business/product model that has already been decided for CRYPE.

It exists so future contributors and AI agents do not reopen core product questions that are already settled.

## Product Thesis

CRYPE is becoming a dual operating platform for:

- signals
- bots
- AI

It is not just:

- a dashboard
- a signal list
- or a collection of technical tools

It should behave like a coherent trading operating system.

## Core Product Shape

CRYPE has two primary user-facing pillars:

### 1. Signals product

This is the user-facing opportunity layer.

It should help the user see:

- what matters now
- what belongs to their watchlist
- what is worth discovering outside their watchlist
- what is high confidence
- what has already happened historically

### 2. Bots product

This is the operating and automation layer.

Bots are not just signals with another label.

A bot is a first-class operating entity with:

- identity
- policies
- environment
- automation mode
- capital assignment
- memory/performance
- risk boundaries

## AI Model

AI is allowed to participate deeply, but not magically.

AI should operate inside policies, limits, and governance.

Expected AI roles:

- analyst
- adjuster
- supervisor

Future conversational use is expected, but only through structured actions and auditable flows.

## User Modes

The product must support:

- manual use
- assisted use
- automated use

This is modeled through:

### Execution environment

- `paper`
- `demo`
- `real`

### Automation mode

- `observe`
- `assist`
- `auto`

These are separate concerns and must remain separate in product and domain logic.

## Universe Model

Bots must support both:

- watchlist-based universes
- bot-owned universes

The UI may simplify this for end users, but the model must support both from the beginning.

## Overlap Model

Default business rule:

- multiple bots may observe the same coin
- multiple bots may surface signals on the same coin
- execution overlap should be restricted by policy by default

This prevents destructive behavior while preserving analytical flexibility.

## Special AI Bot

An unrestricted AI bot type is allowed as a supported product concept.

But:

- it must remain technically isolated
- it must remain financially/accounting isolated
- it must not interfere destructively with the rest of the system

Its freedom is strategic, not destructive.

## End-User Information Policy

End users should primarily see:

- clear opportunities
- clear bot state
- simplified performance
- clear actions
- understandable explanations

End users should not be burdened by default with:

- raw runtime diagnostics
- low-level policy objects
- strategy-engine internals
- technical memory/governance detail

If a metric is useful but too technical, it should be translated.

## Long-Term Product Outcome

When this redesign is mature, CRYPE should feel like:

- a user-facing signals platform
- a user-facing bots platform
- an AI-assisted trading operating system

with:

- cleaner UX
- stronger governance
- more sophisticated signal flow
- better performance measurement
- room for future conversational control
