# Scope

Quality profile: MVP (process rigor) with production-grade code quality bar — ASSUMED, see decisions.md
Baseline approved: 2026-11-07 (derived directly from user's full written spec; technical decisions below are ASSUMED pending correction)

## Core features (vertical slice + immediate expansion — all from user's spec, sections 1–9)
| ID | Feature | Notes |
|---|---|---|
| F-01 | Plugin scaffold & Obsidian integration | TS + esbuild, manifest, settings tab, ribbon/command to open Learning OS views |
| F-02 | Markdown-first data layer | LearningOS/Topics/<Topic>/{Overview,Roadmap,Progress}.md + Lessons/, Exercises/, Reviews/; YAML frontmatter for IDs/status/prereqs |
| F-03 | Learning Dashboard view | Active topics, progress, today's tasks, weak topics, recent activity, Continue/Start actions |
| F-04 | Interactive Roadmap view | Clickable curriculum tree, module/lesson statuses (Not Started/In Progress/Completed/Review Needed/Mastered), prereqs, est. time |
| F-05 | Lesson Reader view | Renders lesson Markdown via Obsidian's native renderer (code highlight, tables, Mermaid, LaTeX, checklists) + interactive exercise widgets, hint/explain-again, mark understood/need-practice, prev/next, open-source-note |
| F-06 | AI Teacher Chat panel | Context-aware chat tied to current topic/module/lesson/exercise; streaming, markdown rendering, history, stop/retry, selection-aware "ask about this" |
| F-07 | AI provider adapter | Pluggable interface; ship Anthropic + OpenAI-compatible adapters; API key in plugin settings (local data.json — see security note) |
| F-08 | Curriculum generation ("Start a new topic") | AI-driven roadmap creation: checks existing progress, asks only missing essentials, assesses level, generates modules/lessons/milestones/exercises/assessments |
| F-09 | Teacher-led lesson flow | 10-step teaching process (concept→why→problem→how→examples→pitfalls→test→evaluate→correct→decide-next), adapted per subject type (language/programming/math/other) |
| F-10 | Exercises & assessment checking | Answer input, AI-graded feedback, explanation of mistakes, does not silently advance mastery on failure |
| F-11 | Progress & mastery tracking | Per-lesson/module status incl. distinct "completed" vs "mastered"; durable progress saved to Markdown, not chat transcripts |
| F-12 | Weak-area detection & review scheduling | Lightweight spaced-repetition-ish scheduling from errors/assessment results/elapsed time; "Review Needed" surfaces in Dashboard/Roadmap |
| F-13 | Progress & Review view | Completion, assessment results, mastered/weak concepts, history, upcoming lessons |
| F-14 | Local-first retrieval & context assembly | Intent classification from UI state + local rules; indexed headings/metadata over LearningOS folder only; ranked/deduped/token-budgeted context; no default embeddings |
| F-15 | Conversation memory compression | Recent-message window + compact rolling summary per lesson; no unbounded transcript resend |
| F-16 | Automatic progress persistence on lesson/assessment completion | Idempotent, safe writes, never silently fail |
| F-17 | Manual-edit sync | External Markdown edits (roadmap/progress/lessons) reflected in UI; conflict detection; never overwrite personal notes without approval |
| F-18 | Edge-case handling (section 9) | Empty/missing files, invalid frontmatter, broken refs, duplicate titles, interrupted streams, API errors/offline, long lessons, topic-switch mid-chat |

## Optional features (valuable, not required for the working vertical slice)
| ID | Feature | Notes |
|---|---|---|
| O-01 | AI Context Inspector | Shows retrieved notes/sections, rationale, token count, model, est. cost before/after send |
| O-02 | Token/cost tracking & configurable budgets | Per-request estimated/actual token count, configurable pricing table |
| O-03 | Mermaid/LaTeX-heavy lesson authoring helpers | Templates/snippets to make generated lessons richer |
| O-04 | Additional AI provider adapters | e.g. local/offline model endpoints beyond the OpenAI-compatible adapter |

## Future features (deferred, not forgotten)
| ID | Feature | Why deferred |
|---|---|---|
| FT-01 | Embeddings/semantic retrieval | Spec explicitly says add only if keyword/metadata retrieval proves insufficient |
| FT-02 | Multi-device sync conflict UI beyond basic detection | Needs real usage data on how conflicts actually arise first |
| FT-03 | Rich analytics dashboards (charts/trends over time) | Polish phase per spec's own build order (section 10) |

## Excluded features
| Feature | Why excluded |
|---|---|
| Sending the full vault or full chat history to the AI by default | Explicitly forbidden by the spec (section 5) |
| Cloud sync / hosted backend | Spec requires vault-local Markdown as source of truth; no backend implied or wanted |
| Mobile-specific UI | Spec describes "Obsidian's desktop experience"; mobile not requested — can revisit later |

## Assumptions (ASSUMED — correct any of these)
- UI framework: Preact (small footprint, component model fits 5 interactive views + streaming chat) instead of hand-rolled DOM or React.
- Lesson content rendering reuses Obsidian's built-in `MarkdownRenderer` (gives Mermaid/MathJax/code-highlight/tables for free) rather than a custom renderer.
- AI providers shipped at v1: Anthropic (Claude) and one OpenAI-compatible adapter (covers OpenAI and many self-hosted-compatible endpoints). More providers = Optional/Future.
- API keys stored via Obsidian's plugin `data.json` (the only persistent local-storage mechanism available to a plugin). This is **plaintext on disk**, protected only by OS file permissions and vault access — not a secrets vault/keychain. This will be stated clearly in settings UI and docs.
- Durable chat knowledge (summaries, decisions, saved explanations) is written into each lesson's Markdown; raw turn-by-turn chat transcripts are NOT persisted to Markdown — kept only in plugin runtime memory for the active session (lost on Obsidian restart by design, per "keep durable knowledge and temporary conversation state separate").
- Single-user, single-vault, desktop-first. No multi-tenant/roles concept (this is a personal tool, not a multi-user product) — role-permission matrix work from the generic factory process is not applicable here.
- Target: Obsidian desktop (Electron). Mobile Obsidian is out of scope for v1 (see Excluded).

## Unresolved decisions
| # | Question | Status |
|---|---|---|
| 1 | Exact AI model defaults (e.g. which Claude/OpenAI model id) | Will default to latest recommended models per provider and expose as a settings dropdown — not blocking |

## Important dependencies
- F-02 (data layer) blocks everything else — must exist first.
- F-07 (provider adapter) blocks F-08/F-09/F-06 (anything AI-driven).
- F-14 (retrieval/context assembly) blocks F-06 being "context-aware" rather than a dumb chatbot.
- F-11 (progress tracking) blocks F-12 (review scheduling) and F-13 (progress view).
