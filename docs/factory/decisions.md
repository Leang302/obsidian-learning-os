# Decisions log

Record every CONFIRMED and significant ASSUMED decision here, newest last.

| Date | Decision | Status | Rationale | Decided by |
|---|---|---|---|---|
| 2026-11-07 | Quality profile: MVP process rigor, production-grade code bar | ASSUMED | User asked for "production-quality" but this is a solo-user local Obsidian plugin, not a multi-tenant product — full Enterprise-grade threat modeling/migrations isn't warranted; code quality/tests still held to a high bar | orchestrator |
| 2026-11-07 | Scope baseline taken directly from user's full written spec (no re-discovery round) | CONFIRMED | Spec was already an exhaustive PRD (11 sections, explicit UI/behavior/architecture requirements) | user (implicit via spec) |
| 2026-11-07 | UI framework: Preact | ASSUMED | Small bundle, component model needed for 5 interactive views + streaming chat, avoids React's weight | orchestrator |
| 2026-11-07 | Lesson rendering via Obsidian's native MarkdownRenderer | ASSUMED | Free Mermaid/MathJax/code-highlight/table support; avoids reimplementing a renderer | orchestrator |
| 2026-11-07 | AI providers at v1: Anthropic + one OpenAI-compatible adapter | ASSUMED | Satisfies "configurable providers through an adapter interface" without overbuilding; more providers = Optional/Future | orchestrator |
| 2026-11-07 | API keys stored in plugin data.json, documented as plaintext-on-disk | ASSUMED | Only persistence mechanism available to an Obsidian plugin; must be disclosed, not hidden | orchestrator |
| 2026-11-07 | Raw chat transcripts never written to vault Markdown; only durable summaries/decisions are | CONFIRMED (from spec section 7/D) | Spec explicitly separates durable knowledge from temporary conversation state | user (implicit via spec) |
| 2026-11-07 | No embeddings/semantic retrieval at v1 | CONFIRMED (from spec section 5B) | Spec explicitly says add only if keyword/metadata retrieval proves insufficient | user (implicit via spec) |
| 2026-11-07 | Desktop-only (Electron) target for v1; mobile Obsidian excluded | ASSUMED | Spec describes desktop experience explicitly; mobile not mentioned | orchestrator |
| 2026-11-07 | Exercise attempt history persisted durably to Markdown (Exercises/<lesson>-<id>.md), not just kept in UI memory | CONFIRMED | Needed so mastery decisions ("two consecutive correct") survive an Obsidian restart, per spec's explicit "do not mark mastered just from opening a lesson" and general progress-durability requirement | orchestrator |
| 2026-11-07 | Lesson bodies generated lazily on first open, not pre-generated for the whole roadmap at Start Topic time | CONFIRMED | Token-cost optimization: never pay for lesson content the learner hasn't opened yet (spec section 5E) | orchestrator |
