# Feature inventory

Implementation states: PROPOSED → APPROVED → DESIGNED → IMPLEMENTING → IMPLEMENTED.
Verification states (independent): TESTING → VERIFIED, or BLOCKED/DEFERRED.
"Implemented" is a claim from writing the code; "Verified" means it was actually run/tested.

| ID | Feature | Implementation | Verification | Notes |
|---|---|---|---|---|
| F-01 | Plugin scaffold & Obsidian integration | IMPLEMENTED | TESTING | tsc + esbuild succeed; not run inside a real Obsidian window in this environment |
| F-02 | Markdown-first data layer | IMPLEMENTED | TESTING | Unit-tested (frontmatter parse/stringify/update, idempotency); real Vault API calls unverified live |
| F-03 | Learning Dashboard view | IMPLEMENTED | BLOCKED | No GUI available here to render/click-test |
| F-04 | Interactive Roadmap view | IMPLEMENTED | BLOCKED | Same |
| F-05 | Lesson Reader view | IMPLEMENTED | BLOCKED | Markdown rendering delegates to Obsidian's own renderer; exercise widgets unit-tested at the parser level only |
| F-06 | AI Teacher Chat panel | IMPLEMENTED | BLOCKED | Streaming/stop/retry/selection-aware ask coded; never run against a live API key here |
| F-07 | AI provider adapter (Anthropic + OpenAI-compatible) | IMPLEMENTED | BLOCKED | No network calls made in this environment; HTTP/SSE parsing logic not independently tested against real API responses |
| F-08 | Curriculum generation | IMPLEMENTED | BLOCKED | Strict JSON-shape validation is unit-testable in isolation but wasn't (time-boxed); never run against a live model |
| F-09 | Teacher-led lesson flow | IMPLEMENTED | TESTING | Prompting only -- correctness of actual AI teaching quality can't be verified without live calls |
| F-10 | Exercises & assessment checking | IMPLEMENTED | TESTING | Grading result parsing covered by safeJson tests; live grading unverified |
| F-11 | Progress & mastery tracking | IMPLEMENTED | VERIFIED | `shouldMarkMastered`/`computeReviewItems` fully unit tested (11 tests); durable exercise-log persistence added and type-checked, not live-tested |
| F-12 | Weak-area detection & review scheduling | IMPLEMENTED | VERIFIED | Same test coverage as F-11 |
| F-13 | Progress & Review view | IMPLEMENTED | BLOCKED | No GUI |
| F-14 | Local-first retrieval & context assembly | IMPLEMENTED | VERIFIED | `assembleContext` unit tested for priority ordering, budget enforcement, no-silent-truncation; `Indexer`'s chunking/scoring itself not unit tested (needs Obsidian `Vault`, not mocked here) |
| F-15 | Conversation memory compression | IMPLEMENTED | TESTING | Recent-window + rolling-summary logic is simple and type-checked; not unit tested directly |
| F-16 | Automatic progress persistence | IMPLEMENTED | TESTING | Idempotency verified for `updateFrontmatter`; end-to-end save-on-completion unverified live |
| F-17 | Manual-edit sync | IMPLEMENTED | BLOCKED | Vault event listeners wired (`onChange`); incremental reindex-on-change coded; never exercised against a real vault |
| F-18 | Edge-case handling | IMPLEMENTED (partial) | TESTING | Invalid frontmatter, missing files, duplicate ids, interrupted streams, API error classification, overflow detection all coded; see README "Known limitations" for gaps |
| O-01 | AI Context Inspector | IMPLEMENTED | BLOCKED | UI toggle + data wired; not visually verified |
| O-02 | Token/cost tracking | PARTIAL | — | Token estimates + budget enforcement done; cost-estimate display from `settings.pricing` not wired into the chat UI yet |
| O-03 | Mermaid/LaTeX lesson helpers | NOT STARTED | — | Relies entirely on Obsidian's native renderer handling it, by design -- not separately tested |
| O-04 | Additional AI provider adapters | NOT STARTED | — | Deferred per scope.md |
| FT-01 | Embeddings/semantic retrieval | NOT STARTED (deferred) | — | Per scope.md, add only if keyword retrieval proves insufficient |
| FT-02/03 | Multi-device conflict UI / analytics dashboards | NOT STARTED (deferred) | — | Per scope.md |
