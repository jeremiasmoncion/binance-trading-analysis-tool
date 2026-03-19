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

The director may write code, but should prioritize coherence over raw output volume.

## Implementer Thread

Responsibilities:

- read assigned task and constraints
- stay inside the assigned scope
- avoid touching reserved/shared files unless explicitly allowed
- update task status and handoff notes
- stop and report when shared contracts must change

## Human Operator

Responsibilities:

- launch the threads
- choose which prompt goes to which thread
- return to the director after each work round
- review GitHub notifications when threads finish a meaningful milestone

## Shared Rule

No thread should assume that another thread has already read its thoughts.

Every important decision must be written into the repo if it affects later work.
