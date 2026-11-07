# VirtualGate action-ID audit (2026-09-29)

Superseded invocation contract (2026-10-04): [Concierge function control](../concierge/CONCIERGE_FUNCTION_CONTROL.md). The address/binding audit below is historical; current packets are navigation v10, Feeds v5 and Creation v5. Concierge now calls a structured function with scroll owner and direction separately; spoken IDs do not trigger execution.

This is a source-and-contract audit, not a claim that a live browser action or paid generation was exercised. The live snapshot is authoritative: a RAG pattern alone cannot authorize or execute a control.

| Surface | Executable address | Payload and browser binding |
| --- | --- | --- |
| Navigation/profile/settings | `clikb.<area>.action.<name>` copied from `navigation.availableActions` | Exactly one visible enabled `[data-ai-action]` target; browser invokes its existing click handler. |
| Feeds | Exact `feeds.availableActions` ID, normally `clikb.feeds.<area>.<name>` | Same mounted-target rule. Feed-card open is the exception: `viewport.<instance>.control.open.<postId>` maps to `viewport.<instance>.action.open.<postId>`. |
| Creation | Exact enabled `creation.controls.areas[*].controls[*].actionId`, normally `clikb.creation.<area>.action.<key>` | `cb(...)` binds the mounted control and its actual handler. Text controls require a separate `textValue` with the **full replacement** value; click controls use the ID without text. |
| Scrolling | `scroll:<live owner ID>:forward` or `:backward` | `forward` means down or right; `backward` means up or left, according to the live owner axis. Browser checks the mounted scroll owner and current boundary. |

For a real app request, Concierge must speak `VirtualGate <exact live ID>`. First Jev checks only whether the latest real user turn requests action; a non-action/failed intent ends without feeding another failure turn to Concierge. For an action, the server obtains a fresh snapshot, asks Concierge for JSON with the **same** `suggestedActionId` and any required `textValue`, then asks Jev to select and approve that exact operation. The browser rechecks Auto Control, policy, visible target and freshness before dispatch. Multi-step flows repeat this sequence per action after browser feedback. Jev, not Concierge, chooses whether the proposal is permitted; neither Jev nor Concierge directly edits React state.

The audit repaired these advertised-but-unbound controls: shared-link Browse All Feeds; fullscreen cancel-delete/close-deleted; mobile Search focus dismissal; legacy Swipe return-to-main; spatial drawer Close; and the minimized profile floating avatar in both layouts. Video resolution options now have their own mounted IDs after opening the dropdown. Audio-unlock controls and spatial alert dismissal are manual-only where a synthetic click would not be reliable. Existing manual boundaries include native file uploads, drawing/canvas operations, hold/drag gestures, Feeds Search text entry, and Auto Control itself. Paid or destructive Creation actions still require a latest-turn target-specific `confirm <action key or label>` (for example `confirm generate video`).

Verification: client/server TypeScript typechecks; all 10 backend test files; all 10 frontend `npm run test:*` suites; the four additional `.test.cjs` suites; the Creation binding contract script; and the production Vite build pass. The Motion Guide and spatial-routing tests had stale module resolution/model expectations; their test harnesses now match the current server package layout and model-tier table. A live browser trace with Auto Control On and the current RAG packets uploaded is still needed to verify end-to-end text entry, scroll, model selection, and generation.

Re-upload the current `01_navigation_profile_settings.rag.txt` (v9), `02_feeds_usage.rag.txt` (v4), and `03_creation_intro.rag.txt` (v4) before testing these revised contracts. No upload was performed by this audit.
