# Multi-Thread Orchestration

## Purpose

This folder defines how multiple AI threads can work on the same CRYPE project without stepping on each other.

Current target model:

- 1 director thread
- 2 implementation threads

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
2. `docs/next-signals-bots-ai/handoff.md`
3. `docs/orchestration/phase-status.md`
4. `docs/orchestration/ownership.md`
5. the thread-specific task file if assigned

## Notification Rule

GitHub is the official human notification channel for meaningful completion.

That means:

- important milestones should end in a git commit
- integration-ready work should be pushed to GitHub
- if possible, use PRs or clear commit messages so GitHub notifies the project owner on mobile

The AI threads do not send direct phone notifications. GitHub is the human-visible completion signal.

## User-Facing Review Rule

Meaningful UI progress must be reviewable from a real end-user perspective, not only from an internal developer/lab perspective.

That means:

- a hidden or hard-to-find lab is not enough for final review value
- if a new surface is still hosted temporarily, it must still be easy for the human operator to find and inspect
- implementation threads should think in terms of eventual end-user delivery from the beginning, not only technical validation
- directors should not announce a UI lot as "ready to review" unless it is actually discoverable and understandable through a realistic product flow

Temporary hosts are allowed during phased delivery, but they should be treated as stepping stones toward user-visible product surfaces, not as the final measure of success.
