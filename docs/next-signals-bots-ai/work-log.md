# Work Log

## 2026-03-20

### Phase

`Bot Core` recovery governance review round

### Completed

- Added a dedicated recovery-governance view inside `Execution Logs` instead of mixing preview recovery signals with generic blocked intents.
- `Execution Logs` now has a `Recovery Governance` filter focused on:
  - expired previews
  - churn pardons
  - manual clears
  - cases already requiring manual review
- Bot-level intent summaries now also expose recovery-specific counts so operators can prioritize the recovery backlog faster.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids burying preview recovery governance inside generic blocked-intent review.
- It also avoids making operators scan row-by-row to understand which bots are already exhausting recovery overrides.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `Manual Clear` should be the final override of the paper lane
  - decide whether a final hard reset path is still necessary
  - keep real trading execution out of scope until recovery governance is fully closed and predictable

### Phase

`Bot Core` manual clear recovery round

### Completed

- Added a stronger recovery override after preview churn pardons are exhausted.
- `Execution Logs` now escalates from:
  - `Pardon Churn`
  - to `Manual Clear`
  - and finally to `Manual Review Required`
- The shared runtime now consumes a one-time `manual clear` override separately from churn pardons.
- Shared diagnostics now count manual clears so recovery pressure remains visible instead of hidden.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids forcing the operator into a dead-end once churn pardons are exhausted.
- It also avoids making stronger overrides invisible to bot diagnostics.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `manual clear` should be the final override or whether a harder reset path still makes sense
  - decide whether `Execution Logs` needs a dedicated recovery-governance filter
  - keep real trading execution out of scope until paper/demo override governance is fully disciplined

### Phase

`Bot Core` preview pardon governance round

### Completed

- Hardened the preview churn recovery path so churn pardons are no longer effectively unlimited.
- The shared runtime now stops honoring repeated churn pardons after the configured safe limit.
- `Execution Logs` now shows:
  - `Pardon Churn` while recovery is still allowed
  - `Manual Review Required` once the pardon limit is reached
- `Signal Bot` and `Bot Settings` now also explain when the pardon limit was hit.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids turning churn pardons into an infinite retry loophole.
- It also avoids showing a recoverable paper lane in UI after the runtime has already become stricter.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `Execution Logs` needs a dedicated pardon-governance filter
  - decide whether the operator should have a stronger reset action after the pardon limit is reached
  - keep real trading execution out of scope until paper/demo override governance stays disciplined end-to-end

### Phase

`Bot Core` preview pardon diagnostics round

### Completed

- Turned preview churn pardons into a tracked shared signal instead of leaving them as hidden recovery metadata.
- Pardon grants now persist as `executionIntentPreviewChurnPardonCount` on the bot-decision seam.
- Shared intent summaries now expose:
  - `pardonedPreviewCount`
  - `previewPardonCount`
- Shared bot attention scoring now also gets harder when repeated churn pardons accumulate.
- `Signal Bot` and `Bot Settings` now surface pardon load as part of the same paper-lane diagnostics.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids repeated churn pardons acting like invisible operator overrides.
- It also avoids understating bot instability when recovery attempts keep stacking up.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether repeated churn pardons should eventually stop being available without stronger review
  - decide whether `Execution Logs` should get a dedicated pardon-focused filter or summary
  - keep real trading execution out of scope until paper/demo recovery overrides remain tightly governed

### Phase

`Bot Core` preview churn pardon round

### Completed

- Added an operator-controlled recovery path for paper preview churn pauses.
- `Execution Logs` now lets the operator grant a one-time churn pardon on a decision blocked by severe preview churn.
- The pardon moves the decision back into:
  - `executionIntentStatus = ready`
  - `executionIntentLaneStatus = dispatch-requested`
- The shared operational loop now consumes that pardon once, allowing a controlled recovery preview attempt instead of reopening the whole bot policy.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids making severe preview churn pauses irreversible.
- It also avoids bypassing runtime safety by reopening the whole paper lane outside the shared bot-decision seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether churn pardons should be counted separately in bot diagnostics
  - decide whether repeated pardons should eventually stop being allowed without stronger review
  - keep real trading execution out of scope until paper/demo recovery paths stay disciplined under repeated churn

### Phase

`Bot Core` paper churn dispatch pause round

### Completed

- Severe paper-preview churn now pauses new paper dispatches inside the shared operational loop.
- The runtime now reuses the same preview churn thresholds already surfaced in the shared bot-attention seam.
- When a bot crosses severe preview churn:
  - new `paper` dispatches are blocked
  - the decision stays in the same governed seam with an explicit operational reason
- This keeps paper-lane safety enforcement inside the runtime instead of only surfacing it in UI.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids continuing to dispatch paper previews from bots whose preview lane is already unstable.
- It also avoids a mismatch where UI says `urgent` but the runtime still keeps dispatching normally.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether execution review should expose a dedicated `paper churn paused` filter
  - decide whether operators can explicitly clear/pardon churn before paper dispatch resumes
  - keep real trading execution out of scope until the paper/demo lane can recover cleanly from churn pauses

### Phase

`Bot Core` selected-bot intent attention round

### Completed

- Brought severe paper-preview churn into the selected bot workspace instead of leaving it only at fleet level.
- Shared bot attention now escalates to `urgent` when preview expiry/refresh churn becomes severe enough.
- `Signal Bot` now shows:
  - `Preview Churn`
  - `Intent Attention`
- This keeps churn severity attached to the operational intent lane rather than overloading ownership health with a different concern.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids hiding severe paper-lane instability inside fleet-only diagnostics.
- It also avoids mislabeling preview churn as pure ownership failure.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether severe intent churn should also influence execution review prioritization more aggressively
  - decide whether `urgent` intent churn should suppress new paper dispatch attempts for the affected bot
  - keep real trading execution out of scope until the safe paper/demo lane remains stable under this stricter attention model

### Phase

`Bot Core` preview attention scoring round

### Completed

- Hardened the shared bot-attention scoring so stale preview churn now matters operationally instead of staying only visual.
- `preview-expired` now increases shared attention pressure per bot.
- Repeated preview refreshes now persist as `executionIntentPreviewRefreshCount` on the decision seam.
- Shared intent summaries now expose:
  - `refreshedPreviewCount`
  - `previewRefreshCount`
- `Bot Settings` now reflects expired preview load and refresh churn inside the weakest-bots diagnostics.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids treating repeated preview expiry/refresh cycles as harmless noise.
- It also avoids inventing local screen-only scoring outside the shared read-model seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether repeated preview churn should also surface inside `Signal Bot`
  - decide whether severe churn should escalate from `watch` to `needs-attention`
  - keep real trading execution out of scope until the safe paper/demo lane remains stable under repeated refresh cycles

### Phase

`Bot Core` preview refresh round

### Completed

- Turned `preview-expired` into an actionable paper-path state instead of a dead-end label.
- `Execution Logs` now lets the operator refresh an expired preview directly from the same bot-decision review seam.
- Refreshing an expired preview now moves the decision back into:
  - `executionIntentStatus = ready`
  - `executionIntentLaneStatus = dispatch-requested`
- The action stays inside the same governed intent lane instead of opening a side workflow.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids making expired paper previews purely informational with no operational recovery path.
- It also avoids opening a second refresh flow outside the shared bot-decision seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether refreshed previews should count in attention scoring
  - decide whether repeated preview expiry should escalate warnings per bot
  - keep real trading execution out of scope until the safe paper/demo lane is fully trustworthy

### Phase

`Bot Core` preview expiry semantics round

### Completed

- Added the first explicit expiry semantics for stale paper previews inside the shared bot-intent seam.
- The shared read-model now upgrades old `preview-recorded` states into an effective:
  - `preview-expired`
- Current heuristic:
  - a preview record expires after 6 hours without further progress
- Shared execution-intent summaries now also expose:
  - `previewExpiredCount`
- `Execution Logs` and `Signal Bot` now use that expiration language directly instead of only saying “stale”.
- Owned-memory notes now also explain when the latest paper preview is already expired and should be refreshed before reuse.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids leaving stale paper previews in a half-alive audit state with no operational consequence.
- It also avoids forcing each surface to invent its own stale-preview interpretation outside the shared seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `preview-expired` should support explicit refresh actions
  - decide whether expired previews should count against attention scoring
  - keep real trading execution out of scope until the safe paper/demo lane is fully trustworthy

### Phase

`Bot Core` preview freshness round

### Completed

- Added a first freshness signal for the safe paper-preview path so `preview-recorded` does not remain only as a binary state.
- Shared intent summaries now also track:
  - `previewFreshCount`
  - `previewStaleCount`
- Current heuristic:
  - a `preview-recorded` intent becomes stale after 6 hours without further progress
- `Signal Bot` now shows fresh vs stale preview counts in the execution-intent area.
- `Execution Logs` intent summaries now also show fresh vs stale preview backlog per bot.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids treating all `preview-recorded` artifacts as equally actionable regardless of age.
- It also avoids leaving the paper path fully binary when operators really need to know whether previews are still fresh enough to matter.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether stale previews should expire automatically or just remain as audit evidence
  - expose promotion or refresh semantics if stale previews should be acted on
  - keep real trading execution out of scope until the safe paper/demo lane is fully trustworthy

### Phase

`Bot Core` preview reconciliation semantics round

### Completed

- Tightened the paper-preview closure semantics after introducing `preview-recorded`.
- Decision outcome sync now also marks preview-confirmed dispatch metadata more explicitly instead of leaving the old generic dispatch status behind.
- Shared owned-memory notes no longer describe a `preview-recorded` decision as if it were still waiting for execution linkage.
- The runtime now explains that case as:
  - a paper preview already recorded in the shared execution plane
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids misleading runtime summaries where a paper preview that is already registered still reads as unresolved execution work.
- It also avoids leaving preview-confirmed decisions with stale dispatch-status semantics.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `preview-recorded` should expire or remain as a durable audit closure
  - surface clearer per-bot preview vs demo closure ratios where useful
  - keep real trading execution out of scope until the safe paper/demo lane is fully trustworthy

### Phase

`Bot Core` preview closure semantics round

### Completed

- Closed the safe paper-preview path more honestly once the execution plane confirms that a preview record exists.
- The bot-owned intent lane now distinguishes:
  - `previewed` for a preview dispatch that has been requested/submitted
  - `preview-recorded` for a preview that already exists as an execution-plane record
- Preview confirmation no longer closes into the same `linked` semantics used by demo execution outcomes.
- Decision outcome sync now marks preview records as:
  - `executionIntentLaneStatus = preview-recorded`
  - `status = approved` when the bot was still pending
- Shared summaries now also track `previewRecordedCount`.
- `Execution Logs` and `Signal Bot` now surface that preview closure state directly instead of collapsing it into generic dispatched flow.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids pretending a preview record is the same as a demo execution linkage.
- It also avoids leaving the paper path half-open after the shared execution plane already confirmed a preview artifact.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `preview-recorded` now needs expiry or promotion semantics
  - expose clearer lifecycle wording for paper-preview closure vs demo execution progress
  - keep real trading execution out of scope until the safe paper/demo lane is fully trustworthy

### Phase

`Bot Core` paper-demo terminal semantics round

### Completed

- Split the generic post-dispatch lane into clearer terminal semantics for the safe operating path:
  - `paper -> previewed`
  - `demo -> execution-submitted`
- The operational dispatch loop no longer collapses both paper preview and demo execute under the same generic `dispatched` label.
- The lane normalizer now preserves those progressed states and does not pull them back into `queued`.
- Shared execution-intent summaries now track:
  - total dispatched aggregate
  - previewed count
  - execution-submitted count
- `Execution Logs` now treats the `Dispatched` filter as the union of:
  - `previewed`
  - `execution-submitted`
  while row labels themselves stay specific.
- `Signal Bot` now also shows that split directly instead of one merged dispatched count.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids overclaiming that a paper preview and a demo execution submit are the same operational event.
- It also avoids hiding the safer `paper` path under semantics that sound closer to order submission than they really are.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - expose richer adapter outcomes per terminal dispatch state
  - decide whether `previewed` now needs its own closure path distinct from demo linkage
  - keep real trading execution out of scope until the safe paper/demo loop is fully trustworthy

### Phase

`Bot Core` dispatch diagnostics round

### Completed

- Enriched the shared decision timeline so dispatch metadata no longer stays buried after the new paper/demo adapter round.
- Bot-owned decision timeline entries now also expose:
  - dispatch mode
  - dispatch status
  - dispatch attempted timestamp
  - dispatch completed timestamp
- `Execution Logs` now surfaces those diagnostics directly:
  - row-level dispatched label now explains mode/status instead of only showing a generic lane label
  - intent summaries now also show the latest dispatch mode/status when present
  - bot summaries now also carry dispatch lane diagnostics per bot
- `Signal Bot` now also explains the latest dispatch more clearly inside the execution-intent section and settings card.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids treating `dispatched` as a black box after the adapter call succeeds.
- It also avoids forcing the operator to inspect raw metadata to understand whether the bot ran a paper preview or a demo execute dispatch.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - surface clearer per-row adapter outcomes for paper preview vs demo execute
  - decide whether `paper` preview dispatch now needs a distinct terminal outcome from `demo` dispatch
  - keep real trading execution out of scope until paper/demo diagnostics are strong enough to trust end-to-end

### Phase

`Bot Core` paper-demo dispatch adapter round

### Completed

- Connected the shared `dispatch-requested` bot-intent lane to the existing shared paper/demo execution adapter instead of inventing a second execution runtime.
- The operational loop now consumes `dispatch-requested` decisions and dispatches them through:
  - `preview` when the bot lane is `paper`
  - `execute` when the bot lane is `demo`
- Successful adapter calls now move intents into an explicit `dispatched` lane while the existing execution-linkage seam can still close them later into `linked`.
- Dispatch failures now stay inside the same governed bot-decision seam as:
  - `executionIntentLaneStatus = blocked`
  - explicit dispatch reason metadata
- Guarded the lane normalizer so a `ready` intent that has already progressed to:
  - `dispatch-requested`
  - `dispatched`
  - `linked`
  - `blocked`
  is not snapped back to `queued`.
- `Signal Bot` and `Execution Logs` now surface the new `Dispatched` lane state explicitly in summaries and filters.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids opening a second dispatch path outside the existing execution adapter seam.
- It also avoids infinite re-queueing where the lane normalizer would otherwise drag progressed intents back from `dispatch-requested`/`dispatched` into `queued`.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - expose clearer dispatch outcome diagnostics per row and per bot
  - decide whether paper-preview dispatches now need a richer terminal outcome than `dispatched`
  - keep direct real-trading emission out of scope until the paper/demo loop is validated end-to-end

### Phase

`Bot Core` paper-demo dispatch request round

### Completed

- Added the next governed step after review approval: queued paper/demo intents can now move into an explicit `dispatch-requested` lane without pretending a real order was already emitted.
- The execution-intent lane now supports:
  - `queued`
  - `dispatch-requested`
  - `awaiting-approval`
  - `blocked`
  - `linked`
- `Execution Logs` now lets the operator request dispatch for queued intents directly from the review table.
- Row labels and filters now reflect that second-stage state explicitly:
  - `Dispatch Requested`
- Blocked intent rows now also surface the shared intent reason more directly instead of falling back to a generic label.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids jumping from `queued` straight to “executed” semantics before there is a governed dispatch stage.
- It also avoids losing blocked-intent context once rejection and guardrail failures start sharing the same lane.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether `dispatch-requested` should now integrate with a real paper/demo execution adapter
  - expose dispatch backlog counts more clearly in fleet-level summaries if they start to matter
  - keep real trading execution out of scope until the paper/demo dispatch path is fully governed end-to-end

### Phase

`Bot Core` execution intent review actions round

### Completed

- Turned the new execution-intent review lane into an actionable flow by adding explicit approve/reject controls for intents waiting on approval.
- `Execution Logs` now lets the operator:
  - approve an `awaiting-approval` intent
  - reject an `awaiting-approval` intent
- Approval now pushes the same decision back into the shared intent lane as:
  - `executionIntentStatus = ready`
  - `executionIntentLaneStatus = queued`
- Rejection now keeps the decision inside the same seam but moves it into:
  - `executionIntentLaneStatus = blocked`
  - review metadata explaining the rejection
- The shared intent summary now counts blocked symbols from lane state, not only guardrail-originated intent status.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids exposing a review lane that can only be observed but not governed.
- It also avoids splitting approval/rejection into a second control path outside the shared bot-decision seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - surface row-level blocked intent reasons more explicitly
  - decide whether queued intents should now support a second-stage `dispatch` action for paper/demo only
  - keep real order emission out of scope until that dispatch path is fully governed

### Phase

`Bot Core` execution intent review logs round

### Completed

- Extended `Execution Logs` so the new paper/demo intent lane is no longer hidden inside the selected bot workspace only.
- The shared decision timeline now carries intent-lane metadata:
  - `executionIntentStatus`
  - `executionIntentLane`
  - `executionIntentLaneStatus`
- `Execution Logs` now supports intent-focused review directly on the shared activity stream:
  - `Queued Intents`
  - `Awaiting Approval`
  - `Blocked Intents`
  - `Linked Intents`
- Added compact per-bot intent review summaries above the table showing:
  - queued counts
  - awaiting-approval counts
  - blocked counts
  - linked counts
  - top ready symbols
  - top blocked symbols
- Decision rows in the logs now also show lane-aware status labels such as:
  - `Queued`
  - `Awaiting Approval`
  - `Intent Blocked`
  - `Linked`
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids building a paper/demo intent lane that only exists in backend/runtime semantics but has no operational review surface.
- It also avoids forcing users to inspect a single bot workspace to understand queue and approval backlog across the fleet.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether queued intents now deserve dedicated approve/reject actions
  - surface blocked-intent reasons more directly per row where helpful
  - keep direct order emission out of scope until review and approval flow are governed end-to-end

### Phase

`Bot Core` paper-demo intent lane round

### Completed

- Took the next operational step after intent summaries by turning `ready` bot decisions into an explicit paper/demo intent lane inside the shared decision seam.
- Operational decisions now persist lane metadata instead of only intent labels:
  - `executionIntentLane`
  - `executionIntentLaneStatus`
  - `executionIntentQueuedAt`
  - `executionIntentReadyForPaperDemo`
  - `executionIntentRequiresApproval`
- The shared loop now auto-normalizes generated decisions into lane states such as:
  - `queued`
  - `awaiting-approval`
  - `assist-only`
  - `observe-only`
  - `blocked`
- When a linked execution outcome appears later, the same lane now closes into `linked` instead of staying ambiguous.
- `Signal Bot` now exposes the queue-level picture of that lane:
  - queued intents
  - awaiting approval
  - linked execution intents
  - latest lane state
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids treating `ready` as if it were already an execution subsystem.
- It also avoids letting paper/demo escalation remain invisible or ad-hoc once the bot starts auto-producing operational decisions.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - expose approval-needed and blocked intent backlog in execution review/logs
  - decide whether paper/demo queued intents now deserve a dedicated execution-review surface
  - keep direct order emission out of scope until that lane is governed end-to-end

### Phase

`Bot Core` execution intent summaries round

### Completed

- Formalized the next operational seam after guardrails by exposing explicit bot-owned execution-intent summaries instead of leaving intent state buried only inside decision metadata.
- Added a shared intent summary over bot decisions with counts for:
  - `ready`
  - `approval-needed`
  - `assist-only`
  - `observe-only`
  - `guardrail-blocked`
- The selected bot workspace now surfaces that summary directly, including:
  - latest intent status
  - latest guardrail reason
  - top ready symbols
  - top blocked symbols
- This keeps the new operational loop explainable without pretending direct order emission is already complete.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids hiding operational readiness behind raw decision metadata once bots have started auto-producing decisions.
- It also avoids jumping directly from runtime guardrails to direct execution before there is a shared intent review layer.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - bridge `ready` bot intents into a more explicit paper/demo execution-intent path
  - expose blocked/approval-needed intent backlog in execution review where useful
  - keep direct order emission out of scope until that intent lane is governed end-to-end

### Phase

`Bot Core` operational guardrails round

### Completed

- Hardened the new operational decision loop with first real bot-level guardrails before any decision can escalate toward execution intent.
- The loop now evaluates:
  - available capital
  - max open positions
  - symbol exposure
  - execution overlap policy
- `auto` bots no longer jump straight from accepted signal to execution-intent status blindly:
  - they can now fall back to `assist`
  - or emit a bot-owned `block` decision when a guardrail is violated
- Operational decisions now persist richer metadata for future execution-intent work:
  - requested notional
  - open position count
  - same-symbol open count
  - projected symbol exposure
  - guardrail code / reason
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids letting the first operational loop behave as if accepted signal plus `auto` mode were enough to justify execution escalation.
- It also avoids hiding why a bot refused to progress a signal once runtime policy starts mattering.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - bridge execution-intent decisions into a more explicit intent contract
  - expose guardrail outcomes in bot diagnostics/logs where useful
  - keep `paper/demo` as the only serious lane until those intents are fully governed end-to-end

### Phase

`Bot Core` operational decision loop round

### Completed

- Added the first shared operational bot loop so active bots can now consume accepted signals and persist bot-owned decisions automatically instead of waiting only for manual workspace actions.
- The runtime now mounts once at app level and reuses the shared seams already in place:
  - bot registry
  - market/signal core
  - bot decisions persistence
- The loop is conservative and policy-governed:
  - `observe` bots auto-register `observe` decisions
  - `assist` bots auto-register `assist` decisions
  - `auto` bots only escalate to `execute` decisions when execution policy actually allows self-execution
- When auto-execution policy is not fully open, `auto` bots fall back to assisted decisions instead of pretending a real order was sent.
- Kept this round at the `signal -> bot decision` layer only; it does not yet emit direct execution orders from the bot runtime.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids calling bots “operational” while they still depend entirely on manual button clicks to create decisions.
- It also avoids faking execution ownership by marking decisions as executed before execution policy really allows it.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - bridge `auto` bot decisions into execution intents more explicitly
  - tighten runtime guards around overlap/exposure/capital before direct execution
  - keep paper/demo first before treating the loop as real-trading capable

### Phase

`Bot Core` fleet recurring-symbol rankings round

### Completed

- Moved recurring backlog symbol ranking into the shared ownership seam so fleet-level bot diagnostics can reuse the same ranking contract instead of flattening symbol lists in the hub.
- `Bot Settings -> Bots Needing Attention` now shows ranked recurring symbols for:
  - decision backlog
  - execution backlog
- Kept the ranking owned by `createOwnershipSummary(...)` so both the bot hub and future surfaces can reuse the same ownership diagnostic shape.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids teaching the fleet hub a weaker flat-symbol model while `Execution Logs` already understands repetition.
- It also avoids growing another local ranking rule inside `Bot Settings`.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - evaluate whether weakest-bot cards should deep-link into `Execution Logs` filtered context
  - decide whether ranked recurring symbols now deserve persistence or backend indexing
  - keep tightening the ownership bridge for bots dominated by the same repeated backlog symbols

### Phase

`Bot Core` fleet attention diagnostics round

### Completed

- Extended the `Bot Settings` weakest-bots panel so the fleet hub now surfaces the same backlog/pocket language already opened in `Execution Logs`.
- Each attention card in the hub now also exposes:
  - unresolved decision symbols
  - unlinked execution symbols
  - best pocket symbol
  - weak pocket symbol
- Kept the diagnostics on top of the same shared ownership/adaptation seam instead of opening another fleet-monitoring runtime.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids giving `Execution Logs` a richer diagnostic language while the fleet hub still stays vague.
- It also avoids teaching the operator two different ways of reading weak bots depending on the page.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether fleet-level attention should also surface recurring-symbol rankings, not only flat backlog symbols
  - evaluate whether the weakest-bot cards should link more explicitly into `Execution Logs` filtered views
  - keep tightening ownership diagnostics for bots repeatedly falling into `watch` and `needs-attention`

### Phase

`Bot Core` execution logs recurring-symbol ranking round

### Completed

- Tightened the new `Execution Logs` pocket summaries so backlog symbols now surface as short ranked lists instead of flat symbol mentions.
- Added compact frequency-based rankings per bot for:
  - unresolved decision symbols
  - unlinked execution symbols
- Kept the ranking local to the active filtered log scope, so the operator sees which symbols are truly repeating in the current view instead of a disconnected global list.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids showing backlog symbols as if they all had the same operational weight.
- It also avoids opening a separate ranking runtime when the active log stream already has the repetition signal we need.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - decide whether these recurring-symbol rankings now deserve persistence or indexed backend support
  - evaluate whether the same ranked-pocket language should rise into the fleet hub
  - keep tightening the ownership bridge for symbols that repeatedly dominate unresolved backlog

### Phase

`Bot Core` execution logs pockets round

### Completed

- Deepened the new per-bot `Execution Logs` summaries so each prioritized bot now surfaces more actionable context instead of only counts.
- Added backlog pocket cues from the shared bot seam:
  - unresolved decision symbols
  - unlinked execution symbols
- Added lightweight outcome-pocket cues from existing bot performance/adaptation signals:
  - best pocket symbol
  - weak pocket symbol
- Kept all of that on top of the same shared bot/read-model seam without opening a second execution-analysis path inside the page.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids turning the new bot summaries into another “pretty but vague” layer that still forces row-by-row diagnosis.
- It also avoids duplicating pocket analysis logic locally in `Execution Logs` when those signals already exist in shared ownership/adaptation summaries.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - add stronger recurring-symbol ranking per prioritized bot
  - decide whether those recurring pockets now deserve persistence or backend indexing
  - evaluate whether the same strongest/weakest pocket language should rise into fleet-level summaries too

### Phase

`Bot Core` execution logs bot summaries round

### Completed

- Extended `Execution Logs` so the page now surfaces compact per-bot summaries above the table instead of leaving the operator with only a raw prioritized stream.
- Kept those summaries derived from the same shared bot seam and the same active filters/scope already driving the log table.
- Each bot summary now exposes:
  - activity count in the current view
  - linked decision count
  - decision-only count
  - unlinked order count
  - owned outcomes
  - unresolved ownership backlog
  - ownership health label
  - adaptation confidence
- When `Attention Bots` is active, the summary stack now follows the same shared weakest-bot priority already used by the hub.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids making `Execution Logs` harder to scan by forcing operators to infer bot-level backlog only from row-by-row reading.
- It also avoids creating another bot-monitoring surface just to summarize the attention scope.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - highlight recurring unresolved symbols per prioritized bot
  - surface stronger per-bot outcome pockets directly from the log summaries
  - evaluate whether some of these attention/outcome summaries now deserve persistence or indexed backend support

### Phase

`Bot Core` execution logs attention scope round

### Completed

- Moved bot-attention scoring into the shared `signals + bots` read-model so the hub and `Execution Logs` no longer depend on separate local prioritization paths.
- The shared seam now exposes:
  - compact `attentionBots` for the fleet hub
  - full `attentionBotIds` for operational filtering
- Updated `Bot Settings` so the weakest-bots panel now reuses the shared ranked list directly instead of rebuilding the same top-3 locally.
- Updated `Execution Logs` so the toolbar now supports a bot-priority scope:
  - `All Bots`
  - `Attention Bots`
- Kept the `Attention Bots` filter bound to the full shared attention set instead of only the top-3 cards shown in the hub.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids drifting into one weakest-bot scoring rule in `Bot Settings` and another in `Execution Logs`.
- It also avoids treating the hub's compact top-3 display as if it were the full operational attention scope.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - add richer per-bot outcome summaries on top of the now-prioritized `Execution Logs`
  - keep tightening recurring unresolved symbols that appear inside the attention scope
  - decide whether any attention/adaptation summaries now deserve persistence or indexed backend support

### Phase

`Bot Core` fleet attention list round

### Completed

- Added a compact weakest-bots attention list to `Bot Settings` so the hub can now point operators toward the bots that most need review.
- The attention list prioritizes bots using shared bot-core signals already available in the read-model:
  - unresolved ownership count
  - reconciliation percentage
  - adaptation confidence
- Kept the list compact and embedded in the existing hub instead of opening another monitoring surface.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids giving the fleet-level hub more summary metrics without also making it easier to see which bots actually deserve attention first.
- It also avoids creating a second monitoring page just to rank weak bots.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - evaluate which owned-outcome/adaptation summaries now deserve persistence or indexed support
  - keep tightening recurring unresolved symbols highlighted by the drill-down and attention list
  - decide whether `Execution Logs` should expose a bot-priority view tied to the same weakest-bots logic

### Phase

`Bot Core` fleet adaptation visibility round

### Completed

- Extended the shared bot read-model so the bot hub can now summarize adaptation readiness across the fleet instead of leaving adaptation only inside the selected bot workspace.
- Added fleet-level adaptation aggregates:
  - learning-ready bots
  - high / medium / low adaptation-confidence counts
- Updated `Bot Settings` so the summary area now includes adaptation readiness for the fleet.
- Updated bot cards with compact adaptation cues:
  - adaptation confidence
  - short adaptive-bias summary
- Reused the existing hub cards and summary primitives instead of adding another dashboard surface.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids making adaptation look important in the selected bot workspace while staying invisible at the fleet-management level.
- It also avoids adding another fleet-only runtime summary path separate from the shared bot seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - evaluate which owned-outcome/adaptation summaries deserve persistence or indexed support
  - keep tightening recurring unresolved symbols highlighted by the drill-down
  - decide whether the fleet hub also needs a compact attention list for weakest bots

### Phase

`Bot Core` ownership drill-down round

### Completed

- Added a compact unresolved-linkage drill-down in `Signal Bot` that only appears when ownership health falls into:
  - `watch`
  - `needs-attention`
- The drill-down now explains:
  - whether decision backlog or execution backlog is leading
  - which unresolved decision symbols stand out
  - which unlinked execution symbols stand out
- Kept that context derived from the same shared ownership seam instead of making the workspace reconstruct unresolved activity locally.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids showing a warning-like health state without any immediate explanation of what is actually wrong.
- It also avoids forcing the operator to leave the selected bot workspace and search manually through `Execution Logs` to understand the backlog.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - expose adaptation summaries where they help at fleet level
  - evaluate whether any owned-outcome/adaptation summaries now deserve persistence support
  - keep tightening unresolved ownership quality where the drill-down keeps pointing to recurring symbols

### Phase

`Bot Core` adaptation summaries round

### Completed

- Added a first bot-owned adaptation summary on top of owned outcomes instead of leaving learning/adaptation only as an abstract future layer.
- The shared read-model can now derive a compact adaptation summary for the selected bot from:
  - owned outcome rate
  - ownership health
  - best/weakest performance pockets
  - current average realized result
- Updated `Signal Bot` with an `Adaptation Readiness` section that exposes:
  - training confidence
  - strongest learned edge
  - weakest pocket
  - adaptive bias
- Kept the summary on the shared seam and reused the existing performance workspace primitives.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids pretending the bot is learning from outcomes while keeping all adaptation language hidden or purely theoretical.
- It also avoids making the UI invent adaptation narratives locally without a shared read-model source.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - add compact drill-down context when ownership health falls into `watch` or `needs-attention`
  - expose the same adaptation summary at fleet level where useful
  - decide whether any of these derived summaries now deserve persistence or SQL indexing support

### Phase

`Bot Core` ownership ratios round

### Completed

- Deepened ownership health so the selected bot workspace now exposes ratios and qualitative health states instead of only raw ownership counts.
- Added shared ownership indicators on top of the read-model:
  - owned outcome rate
  - unresolved rate
  - qualitative health label
- Updated `Signal Bot` so the ownership section now shows:
  - owned outcome rate
  - unresolved rate
  - operational health label with short explanation
- Kept the implementation on top of the same shared ownership seam without introducing another scoring/runtime path in the view.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids forcing the operator to mentally translate raw ownership counts into whether the bot is actually in a healthy state.
- It also avoids defining health logic separately inside the selected-bot visual layer.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - start surfacing adaptation / training summaries from owned outcomes
  - add compact drill-down context for unresolved linkage when the bot is in `watch` or `needs-attention`
  - evaluate whether those health indicators should also appear in the bot hub at fleet level

### Phase

`Bot Core` selected-bot ownership workspace round

### Completed

- Extended `Signal Bot` so the selected bot workspace now exposes ownership health directly instead of forcing the operator to infer it from `Execution Logs` or only from the bot hub.
- Added a dedicated ownership-health section in the performance workspace with:
  - reconciled activity percentage
  - unresolved linkage backlog
  - owned outcomes count
- Added an ownership-health settings card so the selected bot surface now carries the same reconciliation story in both:
  - performance
  - settings
- Reused the existing `SectionCard`, `MetricTile`, and `SettingsCard` primitives without opening a separate workspace family.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids making ownership health visible only at the fleet level while the selected bot workspace still hides its own reconciliation state.
- It also avoids pushing operators back to `Execution Logs` for something the bot workspace should already explain simply.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - add per-bot outcome ratios and health indicators beyond raw counts
  - start surfacing adaptation/training summaries from owned outcomes
  - evaluate whether unresolved linkage details need a compact drill-down inside `Signal Bot`

### Phase

`Bot Core` ownership summaries round

### Completed

- Added per-bot ownership summaries on top of the shared bot read-model so the bot hub can now expose reconciliation health instead of only trades/profit/win-rate.
- Each bot card can now derive and expose:
  - owned outcome count
  - unresolved ownership count
  - reconciliation percentage
- Added aggregated ownership totals to the shared bot summary so the `Bot Settings` header can now reflect:
  - total owned outcomes
  - unresolved ownership backlog
- Updated `Bot Settings` grid and table surfaces so operators can see which bots are cleanly reconciled and which still need linkage work.
- Kept the implementation on the shared bot seam and reused the existing card/table primitives instead of opening a separate operational dashboard.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids hiding ownership quality only inside `Execution Logs` while the main bot hub still looks healthy even when reconciliation is weak.
- It also avoids adding another local runtime summary just to decorate bot cards.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - show unresolved ownership detail inside the selected bot workspace
  - add per-bot outcome ratios and health indicators
  - start deriving adaptation/training summaries from those hardened owned outcomes

### Phase

`Bot Core` execution ownership hardening round

### Completed

- Hardened decision-to-execution and bot-to-execution ownership matching so unresolved orders have more chances to reconcile through stronger existing bridges instead of looser pair-only heuristics.
- Added stronger direct / high-confidence ownership signals:
  - persisted `executionOrderId`
  - shared `marketContextSignature` vs execution `contextSignature`
  - controlled observed-time vs execution-time proximity
- Updated both the decision outcome sync seam and the shared bot read-model to reuse those stronger ownership hints instead of relying only on:
  - `signal_id`
  - symbol / timeframe / strategy
- Direct ownership confidence now also recognizes `executionOrderId` matches as first-class direct linkage.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids lowering ownership thresholds blindly just to hide `unlinked` rows.
- It also avoids keeping the decision sync seam and the shared bot read-model on slightly different ownership logic.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - surface unresolved ownership counts per bot
  - expose per-bot owned outcome summaries and ratios
  - start routing adaptation/training summaries from the hardened owned outcomes set

### Phase

`Bot Core` owned-memory outcomes round

### Completed

- Reworked bot memory-layer derivation so `local`, `family`, and `global` memory now summarize owned activity and owned outcomes instead of leaning mostly on flat decision counts.
- Added a shared owned-memory summary that now tracks per layer:
  - total activity count
  - decision count
  - owned outcome count
  - unresolved decisions still waiting for execution ownership
  - unlinked execution rows still outside a decision bridge
- Updated local bot memory to derive from the same owned activity timeline used by `Signal Bot` and `Execution Logs`, so memory no longer drifts from bot-owned history.
- Updated family/global memory to derive from combined family/platform decision + execution timelines instead of decision-only aggregation.
- Updated `Signal Bot -> Memory Layers` so the visible metric now emphasizes owned outcomes rather than plain decision totals.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids presenting layered memory as if it were learning from real outcomes while still counting mostly raw decisions.
- It also avoids teaching the bot one activity truth in `Execution Logs` and a different memory truth in `Signal Bot`.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - reduce unresolved execution ownership so memory learns from fewer unlinked rows
  - add per-bot outcome summaries and ratios on top of the owned memory layer
  - start using owned outcomes more directly in training/adaptation inputs

### Phase

`Bot Core` execution logs filters round

### Completed

- Turned the `Execution Logs` toolbar from placeholder chips into a real bot-owned activity filter surface on top of the shared activity timeline.
- Added working filters for:
  - all activity
  - linked outcomes
  - decision-only rows
  - unlinked execution orders
- Added real search on the same shared log stream so the page can now filter by:
  - log id
  - pair
  - bot name
  - source / action / status context
- Added an explicit empty state for cases where the selected tab + filters + search produce no visible rows.
- Kept all filtering on top of the shared read-model seam instead of rebuilding local runtime ownership inside the screen.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids leaving `Execution Logs` visually connected to `Bot Core` while still behaving like a mostly static template shell.
- It also avoids introducing another ad-hoc log derivation path just to make filters work on the screen.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - tighten unresolved execution matches so fewer rows remain in `unlinked`
  - start feeding memory/training from owned outcomes instead of flat decision counts
  - deepen outcome-level filters and summaries per bot

### Phase

`Bot Core` bot-owned execution logs round

### Completed

- Reworked the shared `signals + bots` read-model so bot activity can now expose one owned timeline instead of always concatenating decision rows and execution rows as parallel stories.
- Decision timeline entries now carry explicit persisted execution linkage fields directly in the shared seam:
  - `executionOrderId`
  - execution status / outcome status
  - execution linked timestamp
  - linkage reason
- Added a shared `allBotActivityTimeline` that:
  - keeps linked decision rows
  - folds in the matched execution order when one exists
  - leaves unmatched orders visible as standalone execution rows
- Updated `Execution Logs` so the page now consumes that owned activity timeline first instead of double-counting linked decisions and orders.
- Updated `Signal Bot` history so the selected bot reads the same owned activity shape and can show linked outcomes without needing local timeline reconstruction.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids telling the same bot story twice in `Execution Logs` once as a decision and once again as a raw execution row.
- It also avoids teaching `Signal Bot` and `Execution Logs` two different activity shapes when they should be reading one shared bot-owned history seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - tighten the remaining unresolved execution matches
  - start surfacing bot-owned outcome filters in `Execution Logs`
  - feed layered memory/training from the owned activity timeline instead of only from flat decision sets

### Phase

`Bot Core` decision outcome linkage round

### Completed

- Extended the shared bot decision runtime so persisted bot decisions can now enrich themselves with linked execution outcomes from the shared execution plane.
- Added outcome linkage that prefers:
  - direct signal-id bridge
  - then controlled symbol / timeframe / strategy matching
- Linked decision metadata can now persist richer execution outcome fields such as:
  - `executionOrderId`
  - execution status / outcome status
  - realized pnl
  - notional / quantity
  - hold minutes
  - linkage reason
- `Execution Logs` now surfaces that linkage more clearly on the decision side instead of treating all decisions as outcome-blind rows.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids keeping decision history and execution history as adjacent but weakly connected stories.
- It also avoids pushing outcome linkage down into visual surfaces instead of keeping it on the shared decision seam.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - expose bot-owned outcome history more explicitly in `Execution Logs`
  - feed memory/learning from linked outcomes, not only from decisions
  - evaluate whether `bot_decisions` now needs a dedicated SQL migration for indexed outcome linkage fields

### Phase

`Bot Core` performance contracts round

### Completed

- Aligned the shared bot read-model with the explicit `BotPerformanceBreakdown` contract instead of keeping only generic `dimension / label` breakdowns.
- Bot performance slices can now derive richer operational breakdowns by:
  - origin
  - symbol
  - timeframe
  - strategy
  - market context
- `Signal Bot -> Performance` now reads those richer bot-owned breakdowns directly from the shared seam.
- Kept execution-first preference where linked execution outcomes exist, while still falling back to decision-level slices when needed.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids pretending the bot has a real performance contract while still exposing only generic UI buckets.
- It also avoids pushing strategy/origin/timeframe performance logic down into the visual layer.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - persist richer outcome linkage between decision and execution
  - expose stronger bot-owned outcome history in `Execution Logs`
  - let learning/memory consume those richer outcome slices

### Phase

`Bot Core` registry hydration fix

### Completed

- Fixed the bot registry runtime so `Bot Settings` no longer falls back to showing the template/default 5-bot catalog as if it were the user's real bot list.
- The local cache now ignores template-only bot registries and clears that stale fallback instead of rehydrating it into the live app.
- The local cache now also ignores malformed pre-contract bot registries that are missing current required bot runtime fields, so stale browser state cannot block fresh hydration from Supabase.
- The shared bot read-model now keeps an internal fallback bot only for workspace continuity, without leaking that template bot family into the user-visible bot registry list.
- `Bot Settings` now shows an explicit loading / empty / error state when the persisted registry is not available, instead of rendering fake bot cards.
- Fixed `Create New Bot` so opening the quick-edit drawer no longer persists a bot immediately.
- New bot persistence now happens only from `Save Changes` inside the drawer, while the drawer itself starts as a local draft.
- Validated the fix with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids a serious product trust issue where the app could present template bots as if they were user-owned persisted bots.
- It also avoids hiding registry hydration failures behind a visually plausible but incorrect fallback list.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - inspect the persisted bot rows currently stored for the active user
  - reconcile older bot data, if any, into the current contract
  - keep tightening the decision/outcome ownership path

### Phase

`Bot Core` execution ownership round

### Completed

- Extended the shared `signals + bots` read-model so execution orders from the shared execution plane now resolve back to bot ownership instead of staying only as unassigned system trades.
- Added a controlled ownership bridge that prefers:
  - direct `signal_id` matches against bot decisions
  - then constrained heuristic matching by pair / timeframe / strategy context
- Updated bot cards so performance can now prefer linked execution outcomes when they exist, instead of relying only on decision-level inference.
- Updated `Signal Bot` so bot history and performance now expose owned execution outcomes in the same workspace.
- Updated `Execution Logs` so bot labels for execution rows now come from the shared bot read-model instead of ad-hoc local inference.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview -- --host 127.0.0.1 --port 4173`

### Risk Avoided

- This avoids opening a second execution-history runtime just to make bot ownership visible.
- It also avoids keeping bot execution outcomes as a purely visual guess inside `Execution Logs` while the shared read-model already has enough context to resolve them centrally.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - persist richer execution outcomes against bot decisions
  - tighten performance contracts by origin / symbol / timeframe / strategy
  - deepen learning from owned execution outcomes instead of only decisions

### Phase

`Bot Core` shared-learning governance round

### Completed

- Added an explicit `memoryPolicy` to the bot contract so shared learning is no longer only an inferred future idea.
- The bot model can now persist governance for:
  - family sharing
  - global learning
  - promotion to shared memory
  - approval requirement for shared learning
  - family scope label
- Updated the shared bot read-model so family/global memory now respect those policy toggles instead of always behaving as if shared learning were enabled.
- Extended `Bot Settings -> General Settings` with a dedicated `Learning & Memory` section on the same shared primitive language.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids making family/global memory visible in the product while still leaving their governance implicit.
- It also avoids a future AI layer assuming shared learning is always on just because the memory layers exist.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - stronger outcome linkage per decision
  - more explicit performance contracts
  - better execution-history ownership per bot

### Phase

`Bot Core` layered memory round

### Completed

- Extended the shared bot read-model so each bot now derives explicit memory layers instead of only local runtime summaries:
  - local memory
  - family memory
  - global/platform memory
- Kept the learning boundaries explicit by deriving:
  - family memory from bots that share the same bot family
  - global memory from the wider platform bot decision set
- Updated `Signal Bot -> Performance` so the selected bot now exposes that layered memory separation directly.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids collapsing all learning into one flat bot memory bucket.
- It also avoids hiding family/global learning boundaries behind future AI assumptions before those boundaries are visible in the product/runtime model.

### Recommended Next Step

- Continue with the next `Bot Core` round:
  - stronger performance contracts
  - richer outcome linkage per decision
  - optional shared-learning governance controls

### Phase

`Bot Core` activity timeline round

### Completed

- Deepened the shared `signals + bots` read-model so bot decisions now hydrate a richer bot-owned activity timeline instead of staying only as raw records.
- Added shared derived bot activity/performance slices from decisions:
  - decision timeline
  - top performance breakdowns by:
    - symbol
    - timeframe
    - source
- Updated `Signal Bot` history/performance surfaces to consume that shared bot activity layer first.
- Updated `Execution Logs` to consume the richer cross-bot decision timeline instead of relying only on raw decision rows.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids pushing bot history logic down into `Signal Bot` and `Execution Logs` separately with slightly different local derivations.
- It also avoids treating bot activity as only a flat table of raw decisions when the project already needs a clearer bot-owned operational history.

### Recommended Next Step

- Continue the next `Bot Core` round on top of this activity layer:
  - richer performance breakdown contracts
  - family/shared learning boundaries
  - stronger execution outcome linkage per bot

### Phase

`Bot Core` policy controls round

### Completed

- Deepened `Bot Settings -> General Settings` so it now persists more of the real bot operating envelope instead of only generic preferences.
- Added persisted editing for:
  - bot family / owner scope / operating profile
  - execution environment
  - automation mode
  - universe policy
  - dominant + allowed styles
  - preferred + allowed timeframes
  - execution overlap / arbitration mode
  - key execution and AI policy toggles
- Kept the implementation on the same shared bot seam and same `Bot Settings` primitive language instead of opening a second policy runtime or a new visual family.
- Validated the round with:
  - `npm run typecheck`
  - `npm run build`

### Risk Avoided

- This avoids leaving bot identity and policy in a half-modeled state where the contract exists but the user can only edit lightweight preferences.
- It also avoids introducing a parallel bot-policy editor outside the current shared seam and `Bot Settings` surface.

### Recommended Next Step

- Continue with the next `Bot Core` pass on top of these persisted controls:
  - richer bot activity/history
  - stronger performance breakdowns
  - deeper strategy/family learning boundaries

### Phase

`Bot Core` operational identity + persisted activity round

### Completed

- Closed a real contract gap in the bot persistence seam:
  - bot identity
  - notification settings
  - activity summary
  - richer audit/runtime fields
  are now preserved end-to-end instead of being silently normalized away.
- Extended the shared bot domain so each bot can now carry:
  - operating profile
  - owner/isolation identity
  - persisted notification settings
  - persisted activity summary
- Wired `Bot Settings -> Notifications` into the same persisted bot seam already used by:
  - `General Settings`
  - `Risk Management`
- Strengthened the decision bridge so new bot decisions now push real bot-owned runtime state back into the selected bot profile:
  - local memory summary
  - performance summary
  - audit timestamps
  - recent activity snapshot
- Deepened decision metadata from `Signal Bot` so a bot decision now keeps a richer consumed-signal trace:
  - strategy id/version
  - feed kinds
  - scorer/adaptive evidence
  - execution eligibility context
- Updated shared read-model consumers so `Signal Bot` and `Execution Logs` can read the stronger bot identity/activity layer without opening a parallel runtime path.

### Risk Avoided

- This avoids a dangerous partial-contract situation where bot policies/settings looked modeled in TypeScript but were still getting reset or dropped by the API normalization layer.
- It also avoids keeping bot activity/performance as purely visual inference after the platform already introduced dedicated bot decisions.

### Recommended Next Step

- Continue the same phase by moving from summary-level bot activity into richer bot-owned history/performance breakdowns per style, timeframe, symbol, and origin on top of the now-stable decision bridge.

### Phase

`Account settings` template + real-data migration round

### Completed

- Reworked the account/admin settings hub in `ProfileView` so it now behaves like a fuller settings module instead of a mixed admin placeholder.
- Added real tabs for:
  - `Cuenta`
  - `Notifications`
  - `Binance`
  - `Security & API Keys`
- Moved `API Connections` fully into the account/security area and removed the fake exchange catalog from that surface.
- Wired `Security & API Keys` to the real Binance Demo connection already exposed by the shared profile selector:
  - connect
  - refresh
  - disconnect
  - real masked key / permissions / account alias
- Added local persisted user preferences for:
  - language / region
  - session settings
  - notification channels
  - notification alert types
- Added local storage usage readout and controlled cache clearing for the account module.

### Risk Avoided

- This avoids keeping account settings in a half-migrated state where the header and navigation were new but the body still depended on placeholder content and fake exchange cards.
- It also avoids duplicating API connection management across both `Bot Settings` and the account area.

### Recommended Next Step

- Validate the new account/settings module visually in production, then continue with the next bot-core round now that user-owned API/security settings are separated cleanly from bot configuration.

### Phase

`Bot Core` persisted settings round

### Completed

- Extended the persisted bot contract with `generalSettings`.
- Moved `Bot Settings -> General Settings` away from local-only UI state into the selected bot profile.
- Moved `Bot Settings -> Risk Management` away from local-only UI state into the selected bot profile and existing risk/workspace policies.
- Kept the write path on the same shared bot seam instead of adding a second store or feature-local persistence path.

### Risk Avoided

- This avoids leaving two of the most important bot-control tabs as purely visual surfaces with no durable effect.
- It also avoids inventing a separate platform-settings runtime before the bot contract is mature enough.

### Recommended Next Step

- Continue moving the remaining bot settings tabs into persisted contracts, then deepen bot memory/activity/performance over the now-cleaner bot identity.

### Phase

`Signal Core` informational + AI-prioritized separation

### Completed

- Extended the shared signal contracts so published/ranked signals can carry decision/scorer intelligence already stored in `signalMemory`.
- Promoted `AI-prioritized` from a ranking-only heuristic into a real subset informed by:
  - `adaptiveScore`
  - scorer label/confidence
  - execution metadata
- Added an explicit `informational` subset so low-pressure signals stay visible without being confused with the operational funnel.
- Kept the implementation inside the shared `Signal Core` seam instead of rebuilding this classification in views.

### Risk Avoided

- This avoids turning `AI-prioritized` into a cosmetic tag disconnected from the real adaptive/scorer layer the platform already records.
- It also avoids letting informational signals bleed into operable or bot-consumable cohorts simply because they still rank visibly in the feed.

### Recommended Next Step

- Continue deepening `market-wide` and `operable` with more explicit scanner/runtime evidence so the signal funnel can stabilize before the next strong bot-core round.

### Phase

`Signal Core` scanner/runtime context strengthening

### Completed

- Added explicit `marketWideContext` and `operationalContext` to the shared `Signal Core` seam.
- Reused scanner/runtime evidence already present in the system instead of inventing a second discovery layer:
  - latest scan source
  - scheduler evidence
  - cooldown state
  - auto-order counts
  - eligible / blocked cohort averages
- Updated `SignalsView` so discovery and operational surfaces can read that context directly from the seam.

### Risk Avoided

- This avoids turning the discovery and operational tabs into readouts that only show lists without explaining what the scanner/runtime actually did underneath.
- It also avoids re-implementing candidate cohort summaries locally in each view.

### Recommended Next Step

- Keep pushing the same shared seam toward a fuller `Signal Core` contract, then return to `Bot Core` only after the signal funnel is stable enough for bot consumption.

### Phase

`Bot Core` read-model alignment with `Signal Core`

### Completed

- Moved the shared `signals + bots` read-model away from consuming the broad ranked feed as its primary bot source.
- Bots now build their consumable feed from the explicit signal taxonomy:
  - AI-prioritized
  - operable
  - watchlist-first
  - market-wide
  - observational
  - informational
- Updated `Signal Bot` decision-layer mapping so it reads real intelligence metadata first:
  - adaptive score
  - scorer evidence
  - execution eligibility

### Risk Avoided

- This avoids deepening `Bot Core` on top of a wide ranked feed that still hides important semantic distinctions between signal layers.
- It also reduces the chance that bot history and policy decisions get tied to a visual ranking trick instead of real signal state.

### Recommended Next Step

- Finish the last signal-core tightening pass, then return to a stronger bot phase where bot entities can consume the cleaner taxonomy with less ambiguity.

### Phase

`Signal Core` taxonomy contract closure

### Completed

- Formalized the product-facing signal taxonomy inside the shared signal contracts and seam.
- `Signal Core` now exposes one explicit taxonomy contract for:
  - informational
  - observational
  - operable
  - AI-prioritized
- Moved `SignalsView` and the shared bots read-model to consume that taxonomy contract directly.

### Risk Avoided

- This avoids leaving `Signal Core` in a half-closed state where critical signal layers exist only as implicit arrays with no shared domain meaning.
- It also reduces the chance that later bot work drifts back to ad hoc ranked-feed usage.

### Recommended Next Step

- Treat `Signal Core` as sufficiently closed for this phase and return to `Bot Core` so bots can deepen over the cleaner shared signal contract.

## 2026-03-19

### Phase

`Bot Settings` risk-management template round

### Completed

- Replaced the old summary-card placeholder in `Bot Settings -> Risk Management` with a fuller control surface aligned to the template flow.
- Added UI-stage sections for:
  - `Global Risk Controls`
  - `Stop Loss & Take Profit`
  - `Emergency Controls`
  - `Reset to Default`
  - `Save Risk Settings`
- Reused the same shared form primitives already established for `General Settings`:
  - `ui-input-shell`
  - shared select shell
  - shared toggle row
  - shared action-row pattern
- Kept `Risk Management` on the same theme-parity discipline learned from `General Settings`:
  - no local select hacks
  - no theme-forced overrides
  - clear/light mode covered in the same round

### Risk Avoided

- Building `Risk Management` as another one-off page-specific form system would repeat the same drift that already had to be corrected in `General Settings`.
- Reusing the shared shells means the next settings tabs can keep converging on one form language instead of multiplying styling fixes per page.

### Recommended Next Step

- Continue with `Notifications` using the same rule:
  - shared form primitives first
  - theme parity in the same round
  - page-specific layout only where structure is truly different

### Phase

`Bot Settings` notifications template round

### Completed

- Replaced the old notification summary placeholders with a fuller settings surface inside `Bot Settings -> Notifications`.
- Added UI-stage sections for:
  - `Notification Channels`
  - `Alert Types`
  - `Reset to Default`
  - `Save Notification Settings`
- Kept the channel/action rows on the same shared settings language already used in:
  - `General Settings`
  - `Risk Management`
- Preserved the same implementation guardrails:
  - shared toggles
  - same card/panel primitives
  - no local theme hacks
  - clear/dark parity in the same round

### Risk Avoided

- Without this continuity, `Notifications` would become another one-off page inside `Bot Settings`, forcing more repeated fixes for theme, spacing and control treatment.

### Recommended Next Step

- Continue with `API Connections` on the same form/control baseline so the full `Bot Settings` tab family stays visually and structurally coherent.

### Phase

`Bot Settings` api-connections template round

### Completed

- Replaced the old API placeholder cards with a fuller `API Connections` surface.
- Added UI-stage sections for:
  - `Connected Exchanges`
  - exchange cards with sync/settings/delete actions
  - `Add Exchange`
  - `API Security Best Practices`
- Kept the tab on the same shared visual/control architecture used across the rest of `Bot Settings`:
  - shared cards
  - shared button language
  - shared status pills
  - same dark/light theme parity discipline

### Risk Avoided

- This avoids leaving `API Connections` as the only shallow tab in the `Bot Settings` family and prevents another round of one-off visual fixes later.

### Recommended Next Step

- Review the full `Bot Settings` tab family together and tighten any remaining spacing or typography mismatches as one cohesive surface instead of per-tab patching.

### Phase

`Bot Settings` quick-edit drawer round

### Completed

- Added a quick-edit surface from the gear button on each bot card inside `Bot Settings -> All Bots`.
- Implemented it as a right-side drawer instead of a detached popup so the user can keep the bot grid visible in context.
- Added UI-stage quick controls for:
  - bot name
  - investment amount
  - range lower / upper
  - number of grids
  - stop loss / take profit
  - auto-compound toggle
  - delete / cancel / save actions
- Kept the drawer on the same shared control language already used in the rest of `Bot Settings`:
  - shared form inputs
  - shared toggle row
  - shared action buttons
  - theme parity in the same round

### Risk Avoided

- This avoids sending users to a different full page for a lightweight edit and avoids introducing a second modal/dialog system just for bot quick edits.

### Recommended Next Step

- Review the all-bots card grid and quick-edit drawer together for micro-alignment:
  - spacing
  - typography
  - drawer density
  - button hierarchy

### Phase

Global active-tab parity fix

### Completed

- Fixed active tab/chip persistence at the shared theme layer instead of per-page overrides.
- The selected tab state now keeps its highlighted color in both:
  - dark theme
  - light theme
- Applied the fix to the shared `ui-chip.active` treatment so future tab-based pages inherit the correct selected-state behavior automatically.

### Risk Avoided

- Without moving this to the global theme layer, each new tabbed page could silently lose its selected-state highlight again as soon as theme overrides were applied.

### Recommended Next Step

- Reuse shared tab/chip primitives on future pages instead of inventing local active-state styling.

### Phase

System loading identity refinement

### Completed

- Traced the startup loading surface to the real source component: `StartupOverlay`, not just the shared `SystemUiHost`.
- Replaced the static `C` in the startup overlay mark with a true spinner animation inside the same slot.
- Kept the same loading surface and wording, but removed the static letter so the mark now communicates real progress.
- Documented the rule that future loader tweaks must first confirm which loading surface is actually rendering.

### Risk Avoided

- This avoids repeating false-positive fixes on the wrong loader while the visible startup screen keeps shipping unchanged.
- It also avoids leaving a static brand letter in a place that users expect to behave like a loading indicator.

### Recommended Next Step

- Reuse the same spinner treatment for compact startup marks and confirm surface ownership before editing other global loaders.

### Phase

`Bot Settings` -> full bot workspace routing

### Completed

- Added a shared selected-bot seam so `Bot Settings` can choose the active bot detail target without inventing a local navigation state.
- Kept the gear drawer in `All Bots` as quick settings only.
- Made the full bot navigation flow open the current detailed bot workspace screen from `All Bots`.
- Reworked `Signal Bot` so it reads the selected bot context and behaves as the full-screen workspace for the bot chosen in `Bot Settings`.

### Risk Avoided

- Without a shared selected-bot seam, `Bot Settings` and the full bot workspace would drift apart and require page-local state hacks.
- This also avoids multiplying separate detail-page patterns before the product model is ready for dedicated pages per bot family.

### Recommended Next Step

- Keep using `Signal Bot` as the shared detailed bot workspace while the product converges, then split into dedicated bot detail pages only when each family truly needs its own full template.

### Phase

Template-fidelity refinement for `Signal Bot`

### Completed

- Revisited `Signal Bot` with `My Wallet` treated as the live implementation baseline, not just the static template screenshot.
- Reworked the `Signal Bot` visual system so it now leans on the same CRYPE visual language used by `My Wallet`:
  - display typography rhythm
  - quick-stat card treatment
  - chip/button density
  - dark panel contrast
  - shared spacing discipline
- Rebuilt the active-signal cards with stronger CRYPE-consistent panel treatment while keeping the template page flow.
- Tightened signal direction display so cards can surface `BUY` / `SELL` more reliably from the shared signal snapshot instead of drifting into neutral-only presentation.
- Updated UX/style documentation to make `My Wallet` the explicit implementation baseline for future template pages, especially `Signal Bot`.

### Risk Avoided

- Without locking `Signal Bot` to the same visual baseline as `My Wallet`, the redesign risked drifting into a second interface language:
  - correct structure
  - but visibly different product feel
- That would make template migration harder to scale page by page and increase one-off styling debt.

### Recommended Next Step

- Review `Signal Bot` again against the reference and continue polishing:
  - typography scale
  - card icon fidelity
  - spacing micro-alignment
  - badge and action-row matching
  until it feels visibly part of the same CRYPE family as `My Wallet`

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Added a shared `signals + bots` read-model seam in `src/hooks/useSignalsBotsReadModel.ts`.
- Moved `Signal Bot`, `Bots`, `Bot Settings` and `Control Panel -> Overview` away from rebuilding the same ranked feed pipeline inside each view.
- Narrowed template control surfaces to dedicated selectors:
  - `useControlPanelExecutionSelector`
  - `useExecutionLogsSelector`
- Removed `Control Panel -> Overview`, `Bot Settings` and `Execution Logs` from the broader `useMemorySystemSelector` dependency when they only needed a smaller shared slice.
- Updated the architecture doc with the new rule so future template pages reuse the same shared feed/read-model seam instead of inventing local derivations.

### Risk Avoided

- As `Signal Bot`, `Control Panel`, `Bot Settings` and future template pages grow, duplicating the ranked-feed derivation per screen would create drift and make performance tuning harder.
- Keeping those pages on broader runtime selectors would also wake them on unrelated scanner/admin churn even when their real inputs had not changed.

### Recommended Next Step

- Continue the same closure pattern on the next template page:
  - narrow selector first
  - shared read-model seam second
  - page-local presentation logic last

### Phase

UX architecture clarification and template-flow lock

### Completed

- Reviewed the template screenshots as the final authority for:
  - sidebar order
  - submenu hierarchy
  - page nesting
  - top-level section grouping
  - page composition patterns
- Upgraded the UX direction from "template-inspired" to "template-matching".
- Documented the official sidebar architecture for:
  - `MAIN`
  - `TRADING & BOTS`
  - `DEFI & PORTFOLIO`
  - `MARKETPLACE`
- Documented the official template-matching flow for:
  - `Trading`
  - `Control Panel`
  - `Bot Settings`
  - `Execution Logs`
  - `AI Bot`
  - `Signal Bot`
- Documented the rule that end-user surfaces must show the minimum useful information and translate technical internals into simpler product language whenever possible.
- Documented that CRYPE must preserve the migrated visual line from `Dashboard` and `My Wallet` while matching the template flow exactly.
- Added a dedicated style architecture document for template-faithful but well-architected CSS implementation.
- Added a dedicated product operating model document for the agreed business and product logic.
- Added a dedicated AI context pack so a single new AI can onboard into the entire project without relying on prior thread memory.

### Decisions Captured

- The template is now the official UX flow standard, not loose inspiration.
- Sidebar grouping, nesting, and page logic should match the template unless a deviation is explicitly justified.
- The sidebar lower `ACCOUNT` section and bottom user block are part of the required template flow.
- Logout should not remain as an isolated loose action outside the account/user zone.
- Visible naming inside pages should also follow the template by default, including labels, tabs, sections, statuses, and record naming.
- The old legacy `Signal Bot` surface should no longer drive the future UX.
- Technical or admin-heavy information should be translated or withheld from the main user journey.

### Recommended Next Step

Direct the implementer toward exact template-flow migration and direct the refiner toward runtime protection while that migration is mounted.

### Phase

Phase 1 - Discovery and documentation initialization

### Completed

- Reviewed the current project structure with focus on signals, strategy logic, execution, scanner, and adaptive governance.
- Reconstructed the current signal/bot pipeline from code and docs.
- Confirmed product direction toward a dual `signals + bots + AI` platform.
- Captured settled product decisions:
  - dual platform model
  - explicit bot domain
  - watchlist + market-wide signals
  - watchlist or custom-list universes
  - execution environment separated from automation mode
  - unrestricted AI bot with technical/accounting isolation
- Created initial documentation set under `docs/next-signals-bots-ai/`.
- Added orchestration documentation under `docs/orchestration/` for a director thread plus implementation threads workflow.
- Established GitHub as the practical human notification channel for meaningful milestone completion.

### Decisions Captured

- `paper/demo/real` is an execution environment dimension.
- `observe/assist/auto` is an automation mode dimension.
- Bots may observe and signal the same coin, but execution overlap should be policy-governed by default.
- A future conversational assistant should operate via structured actions, not direct uncontrolled mutation.

### Pending

- Define explicit bot domain contracts in code.
- Decide first concrete storage/state location for bot entities.
- Decide initial implementation boundaries for signal feed separation.

### Recommended Next Step

Start Phase 2:

- introduce explicit domain contracts/types for bots, policies, feeds, and overlap
- keep implementation incremental and non-destructive
- if multi-thread execution starts, assign bounded ownership before parallel coding begins

## 2026-03-19 - Realtime Overlay Stability

### Area

Shared realtime overlay application

### Completed

- Made `src/realtime-core/events.ts` no-op aware for `system.overlay.updated`.
- Stopped identical overlay frames from rewriting `connection`, `execution`, and `dashboardSummary` in the shared `system plane`.
- Narrowed heartbeat writes so routine liveness frames only touch stream metadata when the plane is already healthy.
- Updated the architecture doc with the new runtime rule.

### Risk Avoided

- Future bot runtime expansion will increase the density and frequency of operational overlays.
- Without overlay-level deduplication, selector-driven screens would keep rerendering on semantically identical frames.
- That would scale poorly once bot-owned runtime state starts sharing the same hot path.

### Pending

- Evaluate whether emit-side deduplication should also happen in `realtime-core-service/server.mjs`.
- Continue auditing shared runtime paths for equivalent payload writes.

### Recommendation To Director

- Keep `src/realtime-core/events.ts` treated as protected runtime infrastructure.
- Route future bot/live state through the shared runtime path instead of allowing per-screen event consumers.

## 2026-03-19 - Domain Model Foundation

### Phase

Phase 2 - Domain model foundation

### Completed

- Added a new isolated domain surface under `src/domain/` to avoid reshaping the reserved core files during the first implementation round.
- Introduced explicit bot contracts for:
  - bot identity and lifecycle
  - execution environment
  - automation mode
  - universe policy
  - style, timeframe and strategy policy
  - risk, execution, overlap and AI policy
  - memory summary
  - performance summary
- Added default bot scaffolding with:
  - a standard `Signal Bot Core`
  - an isolated `AI Unrestricted Lab`
- Added signal taxonomy contracts separating:
  - `system-signal`
  - `published-signal`
  - `bot-consumable-signal`
  - `execution-candidate`
- Added pure classification/adaptation helpers so future integration can reuse current `ExecutionCandidate` and `ExecutionOrderRecord` outputs without changing the hot path yet.
- Verified the new domain layer with `npm run typecheck`.

### Files Added

- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/adapters.ts`
- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/index.ts`

### Sensitive Areas Avoided

- Did not touch:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/hooks/useMarketData.ts`
  - `src/hooks/useBinanceData.ts`
  - `src/hooks/useSignalMemory.ts`
  - `src/hooks/useMemoryRuntime.ts`
  - `src/hooks/useValidationLabRuntime.ts`
  - `src/hooks/useWatchlist.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - `realtime-core-service/server.mjs`
  - `api/_lib/executionEngine.js`
  - `api/_lib/strategyEngine.js`
  - `api/_lib/signals.js`
  - `api/_lib/watchlistScanner.js`

### Pending

- Decide with the director where the first bot registry should live during Phase 3:
  - shared plane
  - isolated store
  - persistence-backed adapter
- Decide the first integration seam from current execution outputs into:
  - published signals
  - bot-consumable signals
  - bot summaries
- Coordinate with the refiner before any future work that touches runtime hydration, signal memory, or execution eligibility.

### Recommended Next Step

Move into the Phase 2 / Phase 3 bridge:

- wire the new bot registry scaffold into a non-invasive store or selector layer
- expose first read-only bot and signal feed selectors to the existing UI shell
- keep execution and realtime orchestration untouched until the director approves the integration seam

## 2026-03-19 - Domain Registry Seam Round

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Consolidated `src/domain/` as the official landing zone for the redesign during this phase.
- Added a local `bot registry/store seam` inside the new domain layer instead of wiring bot state into shared runtime or app wiring.
- Added registry primitives in `src/domain/bots/registry.ts`:
  - `createBotRegistryStore`
  - `cloneBotRegistryState`
  - `createBotRegistrySnapshot`
- Added minimal read selectors in `src/domain/bots/selectors.ts` for:
  - all bots
  - selected bot
  - bot by id
  - bots by status
  - bots by style
  - execution-ready bots
  - isolated bots
- Added first signal feed adapter boundary in `src/domain/signals/feedAdapters.ts`:
  - execution candidates -> published feed
  - published signals -> bot-consumable feed
- Adjusted the unrestricted AI bot wording so it is documented as a supported isolated example/profile, not a global default policy for all bots.
- Re-exported the new registry/selectors/feed adapter surface through `src/domain/index.ts`.
- Verified the seam with `npm run typecheck`.

### Exact Domain Structure

- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/adapters.ts`
- `src/domain/bots/registry.ts`
- `src/domain/bots/selectors.ts`
- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/signals/feedAdapters.ts`
- `src/domain/index.ts`

### Seam Chosen

- The bot registry/store seam now lives entirely in `src/domain/bots/registry.ts`.
- It is local to the new domain layer.
- It is intentionally not connected yet to:
  - `src/App.tsx`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - shared runtime hooks

### Future Integration Path

- UI should later consume this domain through selectors and adapter outputs, not by reading raw runtime state directly.
- Shared architecture should connect later at an adapter boundary where current execution/signal outputs are translated into:
  - published signal feeds
  - bot-consumable feeds
  - bot summaries
- This keeps the first integration read-only and avoids pushing bot state into the hot path before direction approves the exact seam.

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - `api/_lib/*` sensitive runtime files
  - protected hooks

### Pending

- Define whether the next step should be:
  - a read-only UI surface backed by domain selectors
  - a persistence adapter for the registry seam
  - a feed ranking layer above published/bot-consumable feeds
- Decide the first source-of-truth adapter for feed hydration:
  - execution candidates
  - signal memory snapshots
  - backend payloads

### Director Review Needed

- confirm whether the next round should prioritize:
  - read-only UI composition for bots/signals
  - registry persistence seam
  - feed ranking/prioritization

## 2026-03-19 - Realtime Overlay Semantic Emit Dedup

### Area

Persistent realtime-core overlay emission

### Completed

- Added semantic overlay hashing inside `realtime-core-service/server.mjs`.
- Stopped the external core from treating freshness-only timestamp changes as new `system.overlay.updated` payloads.
- Kept the emitted overlay payload intact for operators while normalizing only the dedup comparison path.
- Updated the shared architecture doc with the emit-side rule.

### Risk Avoided

- The dual `signals + bots + AI` model will increase the number of read-only consumers sharing the same operational overlay.
- Without emit-side semantic deduplication, volatile timestamps would keep publishing equivalent overlays and wake selector-driven surfaces unnecessarily.
- That would scale poorly as more bot/runtime state reuses the same shared hot path.

### Pending

- Audit whether future bot-specific overlay slices should still travel through `system.overlay.updated` or split into a finer taxonomy.
- Continue auditing shared runtimes for equivalent writes that still originate outside the realtime core.

### Recommendation To Director

- Treat `realtime-core-service/server.mjs` as protected runtime infrastructure for future bot/live integrations.
- Require new bot/live emitters to reuse semantic dedup rules instead of publishing freshness-only overlay frames.

## 2026-03-19 - Read-Only Domain Validation Round

### Phase

Phase 2 / Phase 3 bridge

### Completed

- Added a memory-based adapter from `SignalSnapshot[]` into the new published signal feed model under `src/domain/signals/memoryAdapters.ts`.
- Kept the feed hydration source on `signal memory snapshots`, as directed, instead of starting from execution candidates or backend payloads.
- Extended the bot-consumable signal contract so the derivation can expose policy-fit details:
  - universe match
  - timeframe match
  - strategy match
  - policy notes
- Added signal selectors under `src/domain/signals/selectors.ts` for:
  - published feed reads
  - audience slicing
  - high-confidence slicing
  - accepted vs blocked bot-consumable reads
- Built a first read-only inspection surface in `src/components/domain/SignalsBotsReadOnlyLab.tsx`.
- Mounted that surface inside the existing `MemoryView` overview tab so the new domain can be inspected without touching `App.tsx` or shared runtime wiring.
- Added light/dark theme-safe styles for the new inspection surface in `src/styles/content.css`.
- Verified the round with:
  - `npm run typecheck`
  - `npm run build`

### Mapping Used

- `signal memory snapshots` -> `published signal feed`
  - source classification uses active watchlist membership to split `watchlist` vs `market`
  - visibility score is derived from base signal score plus confirmations, watchlist bias, and execution-eligibility hint
- `published signal feed` + `bot policy` -> `bot-consumable feed`
  - current policy fit checks:
    - universe policy
    - allowed timeframes
    - allowed strategies

### UI Built

- New read-only lab surface:
  - published signals
  - high-confidence subset
  - bot policy fit summaries
  - bot-consumable examples showing accepted vs blocked cases
- Host location:
  - `MemoryView` -> `Resumen`
- Why this seam is safe:
  - no new fetch
  - no polling added
  - no new runtime
  - no hot-path integration

### Files Added

- `src/domain/signals/memoryAdapters.ts`
- `src/domain/signals/selectors.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/classification.ts`
- `src/domain/index.ts`
- `src/views/MemoryView.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### What We Learned

- The domain seam remains safe when the first hydration source is `signal memory`, because it gives enough structure to validate:
  - published feed taxonomy
  - bot-consumption derivation
  - policy readability in UI
- Before persistence, the more valuable next step is likely feed ranking/prioritization, because:
  - the UI can already inspect the domain
  - the bigger product risk now is noise management, not local bot registry storage

### Warning

- The working branch currently contains a prior realtime refinement commit (`390d0aa`) that does not belong to the implementer scope originally assigned.
- This round did not touch that area, but the director should take the branch contamination into account during later integration review.

### Publication Note

- This round was published from a clean branch derived from `origin/codex/implementador-bots-signals` to avoid carrying realtime refinement commits outside implementer scope.
- The functional content of the round did not change during cleanup; only the publication path changed.

### Recommended Next Step

- move to ranking/prioritization on top of the published feed
- keep persistence deferred
- keep the next integration read-only until feed quality and visual organization are validated

## 2026-03-19 - Feed Ranking Round

### Phase

Phase 3 - feed ranking / prioritization

### Completed

- Added an explicit ranking layer for `published feed` under `src/domain/signals/ranking.ts`.
- Kept the original feed separation intact:
  - raw published feed
  - ranked published feed
  - high-confidence subset
- Defined a readable composite ranking model using:
  - watchlist bias
  - base score strength
  - visibility score carryover
  - timeframe legibility
  - market-context completeness
  - reason/explainability density
  - directional clarity
- Added ranking tiers:
  - `high-confidence`
  - `priority`
  - `standard`
  - `low-visibility`
- Added ranking selectors so the UI can inspect:
  - ranked feed
  - priority feed
  - high-confidence ranked subset
  - demoted signals
- Extended the read-only lab to show:
  - raw feed
  - ranked feed
  - ranking promotions
  - ranking degradations
  - ranked high-confidence subset
  - bot-consumable derivation from the ranked feed
- Added visible boosts/penalties so the final order is explainable instead of opaque.
- Verified the round with `npm run typecheck`.

### Ranking Behavior

- signals move up when they have:
  - active watchlist relevance
  - strong base score
  - already strong visibility
  - clearer timeframes such as `1h` or `4h`
  - known market context
  - richer reasons
  - defined direction
- signals move down when they have:
  - weak base score
  - noisy timeframes such as `5m`
  - incomplete market context
  - low explainability
  - neutral direction

### Files Added

- `src/domain/signals/ranking.ts`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/selectors.ts`
- `src/domain/index.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### What We Learned

- The current read-only lab is still sufficient for this phase.
- It can hold one more ranking-validation round without needing a dedicated workspace surface yet.
- A bigger visual split should wait until the ranked feed shape stabilizes.

### Recommended Next Step

- keep iterating on ranking defensibility and noise reduction
- refine high-confidence thresholds using real signal-memory evidence
- only consider a bigger dedicated signals/bots surface after ranking behavior feels stable

## 2026-03-19 - Ranking Thresholds And Noise Split Round

### Phase

Phase 3 - feed ranking refinement

### Completed

- Tightened `high-confidence` thresholds so the subset is no longer driven mainly by a single composite cutoff.
- Split the ranked feed into explicit lanes:
  - `watchlist-first`
  - `market-discovery`
- Made `market-discovery` stricter than `watchlist-first` by design:
  - higher thresholds
  - extra penalty for noisy discovery contexts
  - stronger gating before signals can reach `high-confidence`
- Added lane-aware selectors for:
  - watchlist-first ranked signals
  - market-discovery ranked signals
- Kept `raw published feed`, `ranked feed`, and `high-confidence subset` separate.
- Updated the read-only lab to show:
  - a clearer hero/header section
  - more hierarchical quick stats
  - lane segmentation
  - explicit promoted vs degraded ranking moves
  - a clearer split between:
    - overview
    - ranked feed
    - strong subset
    - bot derivation
- Used `TradeBotX` only as a UX/layout reference for:
  - stronger page hierarchy
  - dense quick stats
  - visible segmentation
  - more distinct operational blocks
- Did not copy template HTML or move this layer into a final dedicated module yet.

### Threshold Changes

- `watchlist-first`
  - `high-confidence` now requires a higher score plus:
    - zero major penalties
    - a minimum boost count
- `market-discovery`
  - requires even higher thresholds than watchlist-first
  - gets a discovery penalty by default because the feed is more prone to noise
  - 15m market discovery is penalized further to avoid low-quality promotion

### Signals That Now Stop Rising

- market-wide signals with:
  - incomplete market context
  - neutral direction
  - noisy intraday discovery context
  - weak explainability
- these signals still remain visible in the raw feed, but are now more likely to stay in:
  - `standard`
  - or `low-visibility`
  instead of rising into priority or high-confidence too early

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/ranking.ts`
- `src/domain/signals/selectors.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### Sensitive Areas Avoided

- Still avoided:
  - `src/App.tsx`
  - `src/types.ts`
  - `src/data-platform/*`
  - `src/realtime-core/*`
  - protected hooks
  - `api/_lib/*`

### Visual Direction Note

- The lab remains sufficient for one more refinement round.
- It now starts to move toward the intended future pattern:
  - clearer top hierarchy
  - stronger quick stats
  - visible segmentation
  - stronger operational blocks
- A dedicated surface still feels premature until ranking thresholds stabilize further.

## 2026-03-19 - Raw Vs Ranked Explainability Round

### Phase

Phase 3 - explainability refinement

### Completed

- Added human-readable explainability fields directly to the ranked signal model:
  - `rawScore`
  - `delta`
  - `movement`
  - `primaryReason`
  - `summary`
- Improved `market-discovery` pruning by applying an extra downgrade when discovery signals combine:
  - weak context
  - neutral direction
  - noisy timeframe
  - limited explainability
- Reworked the temporary lab to explain ranking in more human terms:
  - whether a signal goes up, down, or stays stable
  - what changed from raw to ranked
  - what the main reason was
- Added a dedicated `raw vs ranked explainability` block so a reviewer can quickly read:
  - original score
  - ranked score
  - lane
  - tier
  - movement
  - primary reason
- Kept the host temporary, but organized the lab more like a product surface:
  - overview
  - watchlist-first
  - market discovery
  - high-confidence
  - bot-consumable

### Discovery Signals Further Pruned

- additional market-wide signals are now less likely to rise when they combine:
  - incomplete context
  - neutral direction
  - intraday noise
  - weak explainability
- these still exist in raw feed for inspection, but are more likely to land in:
  - `low-visibility`
  - or lower `standard`

### Files Updated

- `src/domain/signals/contracts.ts`
- `src/domain/signals/ranking.ts`
- `src/components/domain/SignalsBotsReadOnlyLab.tsx`
- `src/styles/content.css`

### What We Learned

- the temporary lab is still sufficient after this round
- it now supports human review much better, especially for:
  - what was promoted
  - what was degraded
  - why a discovery signal did not make the cut
- a dedicated final surface still feels premature until explainability language and pruning behavior stabilize further

## 2026-03-19 - Shared Runtime Semantic Dashboard Refresh

### Area

Hybrid Binance runtime refresh stability

### Completed

- Hardened `src/hooks/useBinanceData.ts` so `dashboardSummary` refreshes ignore freshness-only `generatedAt` changes.
- Upgraded the dashboard comparator to look at `topAssets` and recent execution orders semantically instead of treating every refresh as new.
- Made Binance alias hydration no-op aware so profile refreshes do not rewrite the form state when the alias is already current.
- Updated the architecture doc with the runtime rule.

### Risk Avoided

- The future dual runtime will add more read-only surfaces watching the same dashboard summary.
- Without semantic summary comparison, hybrid safety refreshes would keep waking shared selectors even when only metadata changed.
- Equivalent control writes, like alias rehydration, would also keep rippling through the shell for no user-visible change.

### Pending

- Continue auditing shared hooks for semantic-no-op gaps outside `useBinanceData`, especially any remaining hybrid refresh paths that still mix snapshot safety polling with overlay-driven state.
- Revisit whether execution-center comparison also needs deeper semantic checks once bot-owned operational state grows.

### Recommendation To Director

- Keep treating hybrid runtime comparators as protected infrastructure, not view-level behavior.
- Require future bot-facing summary/read-model hooks to define semantic equality up front instead of relying on timestamped payload identity.

## 2026-03-19 - Execution Center Semantic Stability

### Area

Shared execution runtime comparator hardening

### Completed

- Hardened `src/hooks/useBinanceData.ts` so `ExecutionCenterPayload` equality is semantic instead of shallow.
- Added comparator coverage for:
  - `allowedStrategies`
  - `allowedTimeframes`
  - `scopeOverrides`
  - candidate cohorts
  - recent-order cohorts
- Kept equality logic in shared runtime infrastructure instead of letting future template pages decide stability locally.
- Updated the architecture doc with the protected seam rule.

### Risk Avoided

- The exact template UX will introduce more tabs, cards and tables reading the same execution payload.
- With the previous shallow comparator, equivalent refreshes could still wake those surfaces simply because arrays were recreated or because only the first order was inspected.
- That would scale poorly as bots, signals and AI surfaces reuse the same execution runtime.

### Pending

- Continue auditing other hybrid comparators for array/object recreation outside the realtime core.
- Revisit whether scanner and validation payload equality needs the same deeper cohort-level treatment as the new UX expands.

### Recommendation To Director

- Keep execution-runtime comparators in protected shared infrastructure.
- Forbid page-level custom equality/memoization as a substitute for missing runtime stability in new template surfaces.

## 2026-03-19 - Template Feed Selector Narrowing

### Area

Selector-driven stability for template read-only pages

### Completed

- Added a dedicated shared selector for the new `Signals` and `Bots` feed inputs.
- Moved `src/views/SignalsView.tsx` and `src/views/BotsView.tsx` off the broad `useMemorySystemSelector` bundle.
- Limited those pages to the snapshot inputs they actually need:
  - `signalMemory`
  - `watchlists`
  - `activeWatchlistName`
- Updated architecture documentation with the selector-granularity rule for future template pages.

### Risk Avoided

- The template migration will add more read-heavy pages that look simple but can accidentally subscribe to the whole runtime.
- Without narrow selectors, new `Signal Bot` / `Bot Settings` style pages would rerender on execution, scanner or admin-state churn they do not actually use.
- That kind of over-subscription would scale poorly as more tabs and cards are layered onto the shared system plane.

### Pending

- Keep auditing remaining template-facing pages for oversized selectors or broad runtime subscriptions.
- Revisit whether `ControlPanelView` and future `Execution Logs` surfaces need dedicated selector seams before more real data gets attached.

### Recommendation To Director

- Keep selector granularity treated as runtime infrastructure, not as a view-by-view cleanup concern.
- Require new template pages to ask for the smallest shared selector that matches their data contract.

## 2026-03-19 - Scanner Runtime Cohort Stability

### Area

Shared scanner/runtime comparator hardening

### Completed

- Hardened `src/hooks/useMemoryRuntime.ts` so scanner status equality is semantic instead of shallow.
- Added comparator coverage for:
  - scanner target cohorts
  - scanner run cohorts
- Kept scanner/runtime stability in shared infrastructure rather than pushing compensation into future `Control Panel` or `Execution Logs` pages.
- Updated architecture docs with the scanner comparator rule.

### Risk Avoided

- The template flow will eventually attach denser operational surfaces to scanner/runtime state.
- With shallow equality, equivalent refreshes could still wake those pages simply because runs or targets were recreated with the same meaning.
- That would encourage page-local memoization patches instead of fixing the shared runtime seam once.

### Pending

- Continue auditing other shared runtime comparators that may still use shallow array checks for denser cohorts.
- Revisit whether validation/runtime reports need a similar narrowing once `Control Panel` grows real history and operations surfaces.

### Recommendation To Director

- Keep scanner/runtime comparator depth treated as protected infrastructure for the template migration.
- Do not let future UI rounds solve scanner churn from the component layer.

## 2026-03-19 - Signal Bot Active Watchlist Narrowing

### Area

Selector granularity for the `AI Bot -> Signal Bot` page

### Completed

- Narrowed the shared selector used by `SignalsView` and `BotsView` again.
- Replaced the full watchlist collection dependency with only:
  - `signalMemory`
  - `activeWatchlistName`
  - `activeWatchlistCoins`
- Added selector-level equality so non-active watchlist edits do not wake `Signal Bot`.
- Updated architecture docs with the page-specific selector rule.

### Risk Avoided

- `Signal Bot` is about to gain more filters, cards and denser feed surfaces.
- If it stayed subscribed to the whole watchlist collection, edits to non-active lists would still rerender the page and all of its derived ranking/read-model work.
- That would push the implementador toward UI-level defensive memoization instead of fixing the shared seam once.

### Pending

- Continue auditing whether upcoming `Signal Bot` tables/history blocks need further selector splitting once they hydrate richer datasets.
- Revisit whether the feed/ranking read-model itself should move behind a shared memo seam if the page grows significantly more tabs and summaries.

### Recommendation To Director

- Keep `Signal Bot` selector granularity treated as runtime protection, not as a later UI optimization.
- Require future Signal Bot growth to widen selectors only when a new data contract truly needs it.

## 2026-03-19 - User-Facing Signals And Bots Navigation Reform

### Phase

Phase 3 - UX architecture reform

### Completed

- Stopped treating the legacy `Signal Bot` page as the main visual home for the redesign.
- Added two new user-facing pages:
  - `Signals`
  - `Bots`
- Wired those pages directly into the main sidebar so the new work is no longer buried inside the old `MemoryView` flow.
- Updated the dashboard actions so the user can jump into:
  - `Signals`
  - `Bots`
- Built a first dedicated `Signals` surface for end users:
  - overview
  - watchlist-first
  - market discovery
  - high confidence
  - history
- Built a first dedicated `Bots` surface for end users:
  - bot list
  - simple bot performance summary
  - simplified "how it works" explanation
- Kept the underlying new domain logic reusable instead of rebuilding signal logic inside the old legacy page.

### Why This Matters

- The redesign can no longer be judged from a buried internal lab only.
- The user now has visible first-class destinations for signals and bots, closer to the `TradeBotX` navigation model.
- The old page may remain in code temporarily, but it is no longer the only discoverable path for the new product direction.

### Files Added

- `src/views/SignalsView.tsx`
- `src/views/BotsView.tsx`

### Files Updated

- `src/types.ts`
- `src/components/AppView.tsx`
- `src/components/Sidebar.tsx`
- `src/views/DashboardView.tsx`
- `src/styles/content.css`

### Pending

- Continue refining these new pages so they fully replace the legacy `Signal Bot` user experience.
- Decide whether the legacy `memory` route should later become an admin/technical surface only.
- Move more of the new signals/bots experience out of temporary/internal hosts and into these dedicated user pages.

### Recommended Next Step

- keep refining the new `Signals` and `Bots` pages as the primary user flow
- stop investing product UX effort into the old `Signal Bot` page
- let technical/admin detail live elsewhere later if needed

## 2026-03-19 - Template Flow Navigation Migration

### Phase

Phase 3 - template-faithful navigation and page architecture

### Completed

- Rebased the implementer UX work onto the integrated direction and stopped treating generic `Signals` and `Bots` pages as the visible end state.
- Replaced the visible sidebar flow with the `TradeBotX` hierarchy using CRYPE's shared style architecture:
  - `MAIN`
    - `Dashboard`
    - `My Wallet`
    - `My Statistics`
  - `TRADING & BOTS`
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
  - `DEFI & PORTFOLIO`
  - `MARKETPLACE`
- Added first template-aligned product pages for:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`
- Added explicit placeholders for the remaining template destinations so the visible navigation is already correct without inventing interim UX.
- Retargeted the dashboard entry actions to the new flow:
  - Signal CTA -> `AI Bot -> Signal Bot`
  - Bot CTA -> `Control Panel -> Bot Settings`

### Reused

- Existing shared selectors from `src/data-platform/selectors.ts`
- The new domain layer under `src/domain/` for:
  - ranked published feed
  - high-confidence subset
  - bot consumable feed
  - bot registry snapshot
- Shared CRYPE visual architecture from:
  - `Dashboard`
  - `My Wallet`
  - shared buttons/cards/tokens/layout classes

### Files Added

- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/views/TemplatePlaceholderView.tsx`

### Files Updated

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/DashboardView.tsx`
- `src/styles/content.css`

### Risk Avoided

- Avoided extending the legacy signals/bots UX as if it were the final destination.
- Avoided copying template CSS patterns directly into the app.
- Avoided touching protected runtime/data-plane files while still moving the visible product flow to the correct architecture.

### Pending

- Make the new pages even more literal where the template uses richer controls, especially:
  - filters/search interactions
  - deeper subpage content
  - drawer/table/card behavior
- Decide when the old `SignalsView`, `BotsView`, and `ControlPanelView` become removable instead of merely bypassed.
- Fill the placeholder template routes as later product phases open.

### Recommended Next Step

- Continue refining the new template-matched pages instead of reopening generic `Signals` / `Bots` surfaces
- Replace remaining transitional content inside those pages with more literal template behavior where direction approves it

## 2026-03-19 - Template Naming And Account Sidebar Pass

### Phase

Phase 3 - template naming and deeper product surfaces

### Completed

- Completed the lower sidebar structure so it now follows the template more literally:
  - added `Account`
  - added `Preferences`
  - added `Notifications`
  - added `Security & API Keys`
  - added `Invite Friends`
  - added `Subscription`
  - added `Help Center`
- Integrated `Logout` into the user/account block instead of leaving it as an isolated button.
- Added the missing `Bot Templates` entry under `Marketplace`.
- Tightened visible naming so the new pages use template-facing labels for:
  - tabs
  - columns
  - status names
  - action labels
- Deepened the content of the first live template pages:
  - `Control Panel -> Overview`
  - `Control Panel -> Bot Settings`
  - `Control Panel -> Execution Logs`
  - `AI Bot -> Signal Bot`
- Kept all of that on top of CRYPE's shared style architecture instead of importing template CSS patterns directly.

### Why This Matters

- The app now reads much closer to the actual product language of the template, not just its structure.
- The sidebar no longer feels truncated relative to the reference standard.
- The new pages are no longer just layout shells; they are closer to product-ready reading surfaces.

### Files Updated

- `src/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppView.tsx`
- `src/views/ControlOverviewView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/views/ExecutionLogsView.tsx`
- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `src/styles/layout.css`

### Pending

- The remaining placeholder routes still need their full content when direction opens those product areas.
- Some legacy transitional views still remain in the repo, though they are no longer the primary destination.
- A later round may still be needed to make micro-interactions even closer to the template:
  - richer filters
  - drawers
  - more stateful controls

### Recommended Next Step

- keep deepening the template-faithful pages already opened
- decide when to retire the transitional legacy views that no longer represent the target UX

## 2026-03-19 - Signal Bot Page Closure Pass

### Phase

Phase 3 - page-by-page closure

### Completed

- Treated `AI Bot -> Signal Bot` as the first page to close as a real product surface.
- Switched the page to the narrower selector already available for signals/bots feed reading:
  - `useSignalsBotsFeedSelector`
- Stopped relying on the broader memory selector bundle for this page.
- Strengthened `Active Signals` as the main subview:
  - live chips/filters
  - stronger signal cards
  - entry / target / stop loss hierarchy
  - visible user actions
  - cleaner user-facing summaries
- Deepened `Signal History` into a denser template-aligned table with:
  - pair
  - type
  - entry
  - exit
  - P/L
  - duration
  - status
  - date
- Expanded `Performance` into a more complete user-facing summary.
- Simplified `Bot Settings` to the minimum useful controls for the end user.
- Added the lower product blocks from the template:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`

### Reused

- signal memory snapshots as the base read source
- ranked published feed from the new domain
- high-confidence subset
- bot-consumable feed for policy-fit awareness
- CRYPE shared style architecture instead of template CSS copy

### Why This Matters

- `Signal Bot` is now the most mature page in the new flow.
- It can serve as the reference page for closing the rest of the template one page at a time.
- The page now feels closer to product and less like a transitional scaffold.

### Files Updated

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Pending

- The page can still get richer later with deeper interaction patterns if direction wants:
  - drawers
  - richer exports
  - more interactive filters
- But the core visible page architecture and user-facing logic are now substantially closer to closed.

### Recommended Next Step

- use `Signal Bot` as the benchmark page for the next page-closure rounds
- choose the next page and close it with the same full-page discipline

## 2026-03-19 - Signal Bot Literal Fidelity Pass

### Phase

Phase 3 - Signal Bot hard-close refinement

### Completed

- Pushed `Signal Bot` closer to the template visually in a more literal way, not just structurally.
- Reworked the interior rhythm of the page to better match the template in:
  - top stat cards
  - tab container rhythm
  - chip row density
  - active signal card proportions
  - side panel hierarchy
  - lower insight blocks
- Rebuilt the top stats as page-specific cards instead of relying on a more generic summary surface.
- Strengthened `Active Signals` so it now feels more like the template's main product area:
  - stronger price-level treatment for entry / target / stop loss
  - stronger confidence bar hierarchy
  - clearer action row
  - more literal card density and vertical rhythm
- Kept `Signal History` in the template table shape while improving semantic usefulness.
- Tightened the lower blocks so:
  - `Market Sentiment`
  - `AI Insights`
  - `Top Signal Performers`
  feel more like real product modules and less like generic support cards.

### Functional Improvement

- Kept the page on the narrower feed selector:
  - `useSignalsBotsFeedSelector`
- Continued using real derived data from:
  - signal memory snapshots
  - ranked published feed
  - high-confidence subset
  - bot-consumable filtering
- Added more useful real-page derivations for:
  - filtered active cards
  - history rows
  - top performers
  - market sentiment summary
  - AI insight summaries

### User-Facing Simplification

- Continued translating technical ranking into simpler user-facing terms:
  - `AI Confidence`
  - `Completed`
  - `Pending`
  - `Top Signal Performers`
- Avoided dumping raw domain mechanics into the page.
- Kept `Bot Settings` in-page content minimal and user-readable instead of exposing internal system complexity.

### Files Updated

- `src/views/SignalBotView.tsx`
- `src/styles/content.css`
- `docs/next-signals-bots-ai/work-log.md`
- `docs/next-signals-bots-ai/handoff.md`
- `docs/orchestration/phase-status.md`

### Recommended Next Step

- Treat `Signal Bot` as the reference-quality page for the next closure round
- Only continue here later if direction wants final polish beyond this near-closed state

## Bot Settings Hub Round

### What Changed

- Rebuilt `Control Panel -> Bot Settings` on the same visual baseline used by `My Wallet`.
- Moved the page away from the older generic template blocks into:
  - wallet-like quick summary cards
  - exact tab rail for bot/platform settings sections
  - search + status filters + grid/table toggle
  - hoverable bot cards with stronger hierarchy
- Each bot card now exposes a direct settings action that routes to the matching bot surface when that route already exists.

### Shared Data Continuity

- Kept the page on the shared `useSignalsBotsReadModel()` seam.
- Extended the seam with bot-level summary data instead of rebuilding wide derivations only inside the page.
- Continued using the shared signal-memory + ranked-feed pipeline to enrich bot cards.

### Bot Registry Continuity

- Expanded the initial bot registry so `Bot Settings` reflects the actual bot family the product is preparing for:
  - `Signal Bot Core`
  - `DCA Bot Core`
  - `Arbitrage Bot Core`
  - `Pump Screener`
  - `AI Unrestricted Lab`
- This does not create a second runtime.
- It only makes the shared registry seed more faithful to the intended product map.

### Files Updated

- `src/domain/bots/defaults.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/components/AppView.tsx`
- `src/views/BotSettingsView.tsx`
- `src/styles/content.css`

## Bot Settings General Settings Round

### What Changed

- Deepened `Bot Settings -> General Settings` so it no longer reads like a row of summary cards.
- Added a more literal settings surface with:
  - trading preferences
  - automation toggles
  - performance sliders
  - scheduling controls
  - reset/save footer actions

### UX Continuity

- Kept the page on the same visual baseline as `My Wallet`.
- Reused the same dark/light discipline instead of hard-locking the section to one theme.
- Continued using page-local classes only as a thin layer on top of shared UI primitives.

### Scope Note

- These controls are currently a UI-stage configuration surface.
- They do not introduce a second runtime or a page-local persistence path.
- The next phase can connect them to a shared persisted settings model without redoing the layout.

### Files Updated

- `src/views/BotSettingsView.tsx`
- `src/styles/content.css`

## Shared Select Primitive Fix

### What Changed

- Fixed the combo box/select rendering issue from the shared UI layer instead of only patching `Bot Settings`.
- Added a reusable `ui-input-shell` select variant so future select controls can:
  - place the chevron on the trailing edge
  - keep correct padding
  - inherit dark/light theme correctly

### Why This Matters

- The issue was not specific to `Bot Settings`.
- It was a shared styling gap in the base input primitive.
- Fixing it centrally avoids repeating the same bug on future pages.

### Files Updated

- `src/styles/ui-primitives.css`
- `src/styles/theme.css`
- `src/views/BotSettingsView.tsx`

## Bot Registry Persistence Activation

### What Changed

- Activated the first real bot persistence path instead of keeping `Bot Settings` fully backed by the initial registry seed.
- Added a shared `/api/bots` persistence seam with:
  - `GET /api/bots`
  - `POST /api/bots`
  - `PATCH /api/bots/[id]`
- Moved the shared bot registry runtime into the existing selected-bot seam so:
  - `All Bots`
  - quick edit
  - selected bot context
  - full bot workspace
  all read/write against the same registry state.

### Data Continuity

- The registry now treats local storage only as a warm cache.
- Remote bot payloads are canonical when available, matching the same continuity pattern already used by watchlists.
- `Signal Bot` now prefers the bot's persisted `workspaceSettings.primaryPair` before falling back to feed-derived context.

### Product Continuity

- `Create New Bot` now creates a real persisted bot profile instead of remaining a visual-only CTA.
- quick edit now saves back into the same bot registry seam instead of staying as local drawer state only
- start/pause actions now update the real bot status path

### Files Updated

- `api/_lib/bots.js`
- `api/bots/index.js`
- `api/bots/[id].js`
- `src/domain/bots/contracts.ts`
- `src/domain/bots/defaults.ts`
- `src/domain/bots/registry.ts`
- `src/hooks/useSelectedBot.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/services/api.ts`
- `src/views/BotSettingsView.tsx`
- `src/views/SignalBotView.tsx`

## First Real Bot Metrics Round

### What Changed

- The first real bot path now stops showing purely empty placeholder performance.
- `Bot Settings` and `Signal Bot` now derive bot-level runtime metrics from the real shared `signalMemory` snapshots already stored for the user.
- The derivation is scoped by each bot's persisted `workspaceSettings.primaryPair`, so the first bot can behave as a real bot profile without waiting for a separate bot-decisions table.

### Data Continuity

- No page-local fetches were added.
- The read path remains:
  - shared signal memory
  - shared ranked feed seam
  - shared persisted bot registry seam
- Bot cards now enrich the registry with:
  - real signal count
  - real closed outcome count
  - real realized PnL from stored snapshots
  - real win rate from stored outcomes

### Files Updated

- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/BotSettingsView.tsx`

## API Connections Relocation Round

### What Changed

- Removed `API Connections` from `Control Panel -> Bot Settings`.
- Reused the existing account navigation entry `Security & API Keys` as the canonical home for exchange connections and API security.
- Upgraded `Security & API Keys` from placeholder state into a real `ProfileView` tab so the account area now owns:
  - connected exchanges
  - exchange sync/actions
  - API security best practices

### Why This Matters

- Exchange credentials belong to account/security ownership, not bot ownership.
- Bots consume exchange access, but they should not govern or visually own the credential surface.
- This keeps `Bot Settings` focused on bot policy/configuration and prevents the bot hub from absorbing unrelated account responsibilities.

### Files Updated

- `src/components/AppView.tsx`
- `src/views/ProfileView.tsx`
- `src/views/BotSettingsView.tsx`
- `docs/next-signals-bots-ai/user-experience-architecture.md`

## Product Logic Alignment Round

### What Changed

- Reconciled the local redesign docs with the updated product direction:
  - dual `signals + bots`
  - stronger AI role separation
  - governed overlap
  - watchlist-first signal priority
  - conversational future through structured actions
- Added the next structural step explicitly to the plan:
  - `Phase 3.5 - Bot Decision And Activity Layer`
- Extended the domain contracts with the next entities needed for that phase:
  - `BotDecisionRecord`
  - `BotPerformanceBreakdown`
  - `BotConversationAction`

### Why This Matters

- The repo now already has:
  - a persisted bot registry
  - a selected-bot seam
  - a full bot workspace
- The next true blocker is no longer visual architecture.
- It is the missing bot-owned decision/activity layer that should power:
  - real history
  - real bot performance
  - training
  - future conversational audit

### Files Updated

- `docs/next-signals-bots-ai/current-state.md`
- `docs/next-signals-bots-ai/target-architecture.md`
- `docs/next-signals-bots-ai/domain-model.md`
- `docs/next-signals-bots-ai/implementation-plan.md`
- `src/domain/bots/contracts.ts`

## Bot Decision And Activity Base

### What Changed

- Started `Phase 3.5` with a real bot-owned decision/activity seam.
- Added backend handlers for bot decisions:
  - `GET /api/bot-decisions`
  - `POST /api/bot-decisions`
  - `PATCH /api/bot-decisions/[id]`
- Added a shared runtime hook for bot decisions with warm local cache:
  - `src/hooks/useBotDecisions.ts`
- Updated the shared bots read-model so bot cards can prefer bot-owned decisions over pair-only inference when decisions exist.
- Wired `Signal Bot` actions so the bot can now register real manual decisions from its workspace:
  - observe
  - execute
  - block
- Updated `Execution Logs` so bot decisions can appear in the same monitoring surface as execution orders.

### Why This Matters

- The first bot is no longer limited to fake or pair-derived history only.
- We now have the structural base for:
  - real bot history
  - execution logs per bot
  - performance fed by bot-owned activity
  - future training and audit layers

### Supabase Dependency

- This phase now expects a `bot_decisions` table in Supabase.
- The frontend/runtime degrades safely while the table is missing, but full persistence requires that table.

### Files Updated

- `api/_lib/botDecisions.js`
- `api/bot-decisions/index.js`
- `api/bot-decisions/[id].js`
- `src/services/api.ts`
- `src/hooks/useBotDecisions.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/SignalBotView.tsx`
- `src/views/ExecutionLogsView.tsx`

## Market Core And Signal Core Split

### What Changed

- Started the first concrete `Phase 4` split instead of letting bots keep stretching the old mixed signal module.
- Added two new selector seams:
  - `useMarketCoreSelector`
  - `useSignalCoreSelector`
- Added a shared hook:
  - `src/hooks/useMarketSignalsCore.ts`
- The new shared hook now exposes:
  - market context
  - watchlist feed
  - market-wide feed
  - operable feed
  - bot-consumable subset for the currently selected bot
- Strengthened `operable feed` so it now prefers real eligible `execution candidates` from the shared execution overlay.
- Kept a phase-safe fallback to ranked `signalMemory` when execution candidates are absent, so the current system does not go dark on surfaces that still hydrate only memory.
- Let `bot-consumable` reuse that stronger operable cohort first instead of depending only on ranked memory inference.
- Added `scannerDiscovery` into the shared seam so signal surfaces can read watchlist-driven scanner freshness and discovery context without reaching back into memory/runtime bundles.
- Added explicit operational cohorts into the same seam:
  - eligible execution candidates
  - blocked execution candidates
  - observational ranked signals that stay visible but not operational
- Refactored `SignalsView` to read from that shared market/signal seam.
- Refactored the shared `signals + bots` read-model to consume that seam instead of rebuilding the full feed pipeline by itself.

### Why This Matters

- `Market Core`, `Signal Core`, and `Bot Core` now have a cleaner boundary.
- This keeps us from finishing bots on top of a still-mixed signal module.
- It also clarifies what we are reusing from the old project instead of discarding:
  - market plane context
  - signal memory
  - watchlist scanner
  - ranked feed logic
  - execution-candidate bridge

### Files Updated

- `src/data-platform/selectors.ts`
- `src/domain/signals/feedAdapters.ts`
- `src/hooks/useMarketSignalsCore.ts`
- `src/hooks/useSignalsBotsReadModel.ts`
- `src/views/SignalsView.tsx`

## Account Tab Template Alignment

### What Changed

- Reworked the `Cuenta` tab inside `ProfileView` so it reads closer to the template account screen.
- Split the surface into four independent cards:
  - `Profile Settings`
  - `Language & Region`
  - `Session Settings`
  - `Data & Storage`
- Removed the extra runtime/admin block from the account tab so the page stops feeling like an operations dashboard.
- Kept the already-working local account settings and storage actions on top of the new card composition.

### Why This Matters

- The prior version still mixed account settings with internal runtime reporting.
- The template uses a cleaner four-card settings layout with stronger scanability.
- This improves UX fidelity without introducing a second visual system.

### Files Updated

- `src/views/ProfileView.tsx`
- `src/styles/content.css`

## Account Header Simplification

### What Changed

- Removed the extra hero/status block above the account tabs.
- Removed the visible `Binance` tab from the account settings surface.
- Redirected any account entry that still targets `binance` into `Security & API Keys`.
- Replaced the old account tabs bar with the same tab architecture already used in `Bot Settings`.

### Why This Matters

- The upper summary strip added unnecessary admin noise before the actual settings tabs.
- Binance connectivity now belongs to the API/security flow, so exposing it as a separate tab duplicated the same workflow.
- This makes the account surface read closer to the template and to the wallet/bot-settings tab pattern already adopted in the app.

### Files Updated

- `src/views/ProfileView.tsx`
