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
- task file status is updated
- handoff notes are written
- any phase-impacting decision is documented
- meaningful progress is committed for GitHub visibility

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
