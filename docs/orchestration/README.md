# Multi-Thread Orchestration

## Purpose

This folder defines how multiple AI threads can work on the same CRYPE project without stepping on each other.

Current target model:

- 1 director thread
- 2 implementation threads

It should also be useful when a single new AI thread must take over the whole project and quickly understand:

- current architecture
- current UX direction
- current work split
- current phase
- current constraints

The repository itself is used as the shared coordination surface.

## Main Rule

Threads do not coordinate by hidden memory. They coordinate through:

- repository documentation
- task ownership
- handoff files
- phase status
- Git history

## Threads

- Director
  - owns planning, sequencing, integration, and handoff
- Implementer A
  - executes a bounded task area
- Implementer B
  - executes another bounded task area

## Required Reading Order For Any New Thread

1. `docs/next-signals-bots-ai/README.md`
2. `docs/next-signals-bots-ai/area-status.md`
3. `docs/next-signals-bots-ai/ai-context-pack.md`
4. `docs/next-signals-bots-ai/handoff.md`
5. `docs/orchestration/phase-status.md`
6. `docs/orchestration/ownership.md`
7. the thread-specific task file if assigned

## Single-AI Rule

If only one AI thread is working the project, it should still use the same documentation as if it were replacing the director, implementer, and refiner roles at once.

That AI should treat:

- `docs/data-architecture.md`
- `docs/realtime-core-service.md`
- `docs/next-signals-bots-ai/area-status.md`
- `docs/next-signals-bots-ai/style-architecture.md`
- `docs/next-signals-bots-ai/user-experience-architecture.md`
- `docs/next-signals-bots-ai/product-operating-model.md`
- `docs/next-signals-bots-ai/implementation-plan.md`
- `docs/next-signals-bots-ai/handoff.md`

as the minimum context set before making major changes.

## Notification Rule

GitHub is the official human notification channel for meaningful completion.

That means:

- important milestones should end in a git commit
- integration-ready work should be pushed to GitHub
- if possible, use PRs or clear commit messages so GitHub notifies the project owner on mobile

The AI threads do not send direct phone notifications. GitHub is the human-visible completion signal.

## Branch And Deploy Rule

Future AI threads should assume this delivery workflow unless the human owner says otherwise:

- `main` is the active development branch
- when a scoped task is complete and validated, save that work in `main`
- do not treat `codex` as the default development branch
- `codex` is reserved for explicit human-requested checkpoints only
- do not deploy to Vercel automatically after every task
- for logic/runtime/architecture tasks, deploy to Vercel only when the human explicitly asks to see/review the changes
- for primarily visual UI changes, it is acceptable to provide the review link once the task is validated, because browser review is part of the work itself
- when the human asks to review changes in the browser, the default review link should be the public production alias:
  - `https://binance-trading-analysis-tool.vercel.app`
- deployment-specific Vercel URLs can be shared as supporting detail, but the public alias is the canonical review URL unless the human asks for something else

Practical consequence:

- default close-out is:
  - implement
  - validate
  - commit/save to `main`
- only add:
  - Vercel deploy
  - production link delivery through `https://binance-trading-analysis-tool.vercel.app`
  when:
  - the human asks for review
  - or the task is explicitly visual and browser review is the natural completion step

## Supabase Help Rule

When future AI threads reach a point where Supabase needs a manual schema or data operation that cannot be executed directly from the current environment:

- provide the exact SQL query to the human
- state briefly why the query is needed
- prefer ready-to-run SQL instead of vague setup instructions

## User-Facing Review Rule

Meaningful UI progress must be reviewable from a real end-user perspective, not only from an internal developer/lab perspective.

That means:

- a hidden or hard-to-find lab is not enough for final review value
- if a new surface is still hosted temporarily, it must still be easy for the human operator to find and inspect
- implementation threads should think in terms of eventual end-user delivery from the beginning, not only technical validation
- directors should not announce a UI lot as "ready to review" unless it is actually discoverable and understandable through a realistic product flow

Temporary hosts are allowed during phased delivery, but they should be treated as stepping stones toward user-visible product surfaces, not as the final measure of success.

## Delivery Format Rule

When the director reports a meaningful round or integration lot to the human operator, the delivery should include both:

- a user-facing summary
- a technical/orchestration summary

The user-facing summary should explain, in product terms:

- what changed for an end user
- where to find it in the UI
- how to use it
- what is still temporary or limited

The technical/orchestration summary should explain:

- what the implementer changed
- what the refiner changed
- what each side should do next
- what the next big milestone is

Do not deliver only low-level technical notes when the operator is trying to understand actual product progress.

## Visual Primitive Rule

For visual work, future AI threads should treat the existing template visual primitives as the first implementation option, not as inspiration only.

That means:

- first reuse the shared visual primitives already established in the app
- first match the tab, chip, card, form, and panel patterns already proven in template-aligned surfaces
- only create page-local visual variants when the primitive layer truly cannot express the needed behavior
- if a page-local variant is necessary, it should still extend the same visual family instead of creating a parallel design language

Practical consequence:

- `My Wallet`
- `Dashboard`
- `Bot Settings`

should be treated as the primary visual architecture references before inventing a new page-specific solution.
