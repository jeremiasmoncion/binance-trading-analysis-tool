# Roles

## Director Thread

Responsibilities:

- read global state before assigning work
- define phases and subphases
- split work into bounded tasks
- maintain planning and handoff documentation
- detect conflicts across implementation work
- decide integration order
- prepare prompts for implementation threads
- update ownership and phase status
- judge UI readiness from an end-user review perspective, not only a technical/dev-lab perspective
- report completed rounds in two layers:
  - a user-facing/product summary
  - a technical/orchestration summary with next steps and next major milestone

The director may write code, but should prioritize coherence over raw output volume.

## Implementer Thread

Responsibilities:

- read assigned task and constraints
- stay inside the assigned scope
- avoid touching reserved/shared files unless explicitly allowed
- update task status and handoff notes
- stop and report when shared contracts must change
- treat new UI work as future end-user product surface, not only as an internal lab
- if a temporary host is used, keep the result easy to find and realistic enough for human review

## Human Operator

Responsibilities:

- launch the threads
- choose which prompt goes to which thread
- return to the director after each work round
- review GitHub notifications when threads finish a meaningful milestone

## Shared Rule

No thread should assume that another thread has already read its thoughts.

Every important decision must be written into the repo if it affects later work.

UI-specific shared rule:

- a UI change is not considered truly review-ready if it only exists behind an obscure internal path that a normal operator would not reasonably find
- technical validation hosts are acceptable, but they should not become the default standard for "done"

Delivery-specific shared rule:

- when presenting progress to the human operator, explain both:
  - what changed in end-user terms
  - what changed technically on the refiner side and implementer side
- every substantial delivery should also state:
  - what comes next for the refiner
  - what comes next for the implementer
  - what the next big product/architecture milestone is
