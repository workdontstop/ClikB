# ClikB control RAG

This installation uses exactly the five current instruction packets below. Each describes the app as it works now. Current values, permissions, ownership and executable actions come from the authoritative live snapshot and mounted browser controls.

| Current local packet | Version | Replace document ID |
| --- | ---: | --- |
| [01_navigation_profile_settings.rag.txt](01_navigation_profile_settings.rag.txt) | 32 | clikb_navigation_shell |
| [02_feeds_usage.rag.txt](02_feeds_usage.rag.txt) | 19 | clikb_feeds |
| [03_creation_intro.rag.txt](03_creation_intro.rag.txt) | 31 | clikb_creation |
| [04_deck_overlay.rag.txt](04_deck_overlay.rag.txt) | 10 | clikb_deck |
| [01_clikb_app_overview.rag.txt](01_clikb_app_overview.rag.txt) | 13 | clikb_core_identity |

Replace each packet under its existing document ID and remove superseded chunks with its metadata deleteFilter. Do not upload this README, release reviews, implementation plans or descriptive guides as additional operational packets. Keep the retrieval set scoped to these five IDs.

All five uploads remain unconfirmed. The [Social release review](../CLIKB_SOCIAL_RELEASE_REVIEW.md) records the separate database, deployment and acceptance steps. Upload matching packets with the matching frontend and backend.

Instruction packets contain only current product facts and control meanings. Keep release history, what changed, migrations, previous versions, test reports and deployment checklists in separate documentation. Replace a stale claim instead of appending a correction or another variant.

The shared virtualGate function uses fresh snapshots, Jev intent and exact approval, independent Auto Control and Video permissions, and browser validation. Spoken command markers and RAG control patterns never execute. See [Concierge function control](../concierge/CONCIERGE_FUNCTION_CONTROL.md). Private message content and current project data belong in live state or scoped creation memory, not instruction RAG.

The backend bundles a generated selection of the Creation packet for Image Prompt Pacer fallback. After changing that packet, run node scripts/sync-image-pacer-workflow.cjs, then node scripts/sync-image-pacer-workflow.cjs --check. The generated source uses the packet's version and exact normalized content hash.
