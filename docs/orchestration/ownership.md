# Ownership

## Purpose

This file tracks temporary ownership boundaries while multiple threads work in parallel.

## Shared Core Files - Treat As Reserved

These should not be modified by multiple implementation threads at once unless explicitly coordinated:

- `src/App.tsx`
- `src/types.ts`
- `src/data-platform/*`
- `api/_lib/executionEngine.js`
- `api/_lib/strategyEngine.js`
- `api/_lib/signals.js`
- `api/_lib/watchlistScanner.js`

## Ownership Model

### Director

Owns by default:

- repo-wide documentation under `docs/`
- architecture-level decisions
- integration notes
- ownership updates
- phase status

### Implementer A

Assign explicit scope per round.

Recommended for:

- isolated frontend surface
- bot UI module
- signal module UI
- selectors or domain files that are not currently shared by another implementer

### Implementer B

Assign explicit scope per round.

Recommended for:

- backend/domain layer
- stores
- adapters
- isolated runtime modules

## Rule

If a file is not explicitly owned, assume it is shared and ask the director through repo documentation/handoff flow before reshaping it heavily.
