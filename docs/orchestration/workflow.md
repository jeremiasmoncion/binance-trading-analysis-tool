# Workflow

## Execution Loop

### Round 0

Director prepares:

- architecture context
- current phase
- task split
- ownership rules
- prompts for implementers

### Round 1

Human launches:

- Implementer A
- Implementer B

Each implementer:

- reads repo documentation
- completes assigned task
- updates handoff/task files
- commits meaningful progress

### Round 2

Human returns to the director with the updated repo state.

Director then:

- reviews changes
- checks phase completion
- resolves overlap/conflicts
- updates documentation
- defines next tasks

Then the loop repeats.

## Definition Of Done For A Task

A task is not done until:

- scoped code work is complete
- local validation passes for the scoped task
- the validated work is saved in `main`
- task file status is updated
- handoff notes are written
- any phase-impacting decision is documented
- meaningful progress is committed for GitHub visibility

## Branch Handling Rule

By default:

- work in `main`
- save validated work in `main`
- do not update `codex` unless the human explicitly asks for a checkpoint branch update

If a future AI finds itself on another local branch by accident, it should realign the validated work back into `main` instead of leaving the canonical state somewhere else.

## Deployment Rule

By default:

- do not deploy to Vercel automatically at the end of a task
- do not send production/deployment links for logic/runtime/architecture work unless the human asked to review changes in the browser
- for primarily visual work, a review link may be provided after validation because visual confirmation is part of the acceptance flow

When a deployment/review link is appropriate:

- deploy the validated state
- provide the public production review URL:
  - `https://binance-trading-analysis-tool.vercel.app`
- optionally include the deployment-specific Vercel URL as supporting detail when useful

This applies when:

- the human explicitly asks to see the changes
- or the task is mainly visual and the AI is closing the loop for browser review

## GitHub Notification Practice

To make GitHub useful as a notification layer:

- use one clear commit when a meaningful subphase is complete
- prefer commit messages with a stable prefix, for example:
  - `phase-2: define bot domain contracts`
  - `impl-a: complete signal feed selectors`
  - `impl-b: add bot policy store skeleton`
- push finished milestones so GitHub can notify the owner

## Reserved Files Rule

Shared files should be treated carefully:

- top-level architecture docs
- central shared types
- global stores
- root app wiring

If an implementation task requires touching these, the director should either:

- explicitly assign it
- or absorb it into integration work
