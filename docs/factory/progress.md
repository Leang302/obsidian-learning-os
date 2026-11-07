# Progress

Last updated: 2026-11-07

## By feature
See `feature-inventory.md` for the full table. Summary: the entire vertical
slice (Start Topic → Roadmap → Lesson → Chat → Exercise → Progress →
Recommend Next) is **implemented** and **type-checks + builds cleanly**.
All pure logic (frontmatter handling, path/slug logic, intent
classification, review scheduling/mastery rules, context assembly/budget
enforcement, safe JSON parsing, exercise-block parsing) is **unit tested
and passing (47/47 tests)**. UI rendering, Obsidian Vault API behavior,
and live AI provider calls are **not verified** -- there is no GUI/Electron
available in this environment to run Obsidian itself.

## By workflow
| Workflow | Status |
|---|---|
| Start Topic → generate roadmap | Implemented, logic-level tested, not live-run |
| Open Lesson → lazy-generate content | Implemented, not live-run |
| Chat with Tutor (context-aware, streaming) | Implemented, not live-run |
| Complete Exercise → grade → persist | Implemented, mastery/review logic verified by unit tests; persistence path type-checked, not live-run |
| Recommend Next Lesson | Implemented (pure local logic, no AI call) |
| Manual Markdown edit → UI reflects it | Vault event wiring implemented, not live-run |

## Current blockers
- No Obsidian GUI/Electron runtime available in this sandboxed environment
  to actually load the plugin, click through the five views, or make a
  real AI provider call. This is an environment limitation, not a design
  gap -- see README's install instructions to verify locally.

## Next actions (in priority order)
1. Load the plugin into a real (test) vault per README, click through all
   five views, and fix anything that breaks on actual Obsidian APIs.
2. Configure a real API key and run the full Start Topic → Lesson → Chat →
   Exercise loop once end-to-end; watch for anything the type system
   couldn't catch (e.g. actual SSE event shapes from the live API).
3. Restart Obsidian after creating a topic and confirm progress/lesson
   status survives (persistence-after-restart, an explicit spec requirement).
4. Hand-edit a Roadmap.md or Progress.md file externally and confirm the
   UI picks up the change without corrupting anything.
5. Add unit tests for `Indexer`'s chunking/scoring once there's a
   lightweight way to fake Obsidian's `Vault`/`TFile` (currently untested
   because `VaultStore` takes a real Obsidian `App`).
6. Wire `settings.pricing` into an actual cost estimate shown in the
   Context Inspector (currently only token counts are shown).
7. Decide whether a dedicated multi-question Assessment flow (beyond
   single-exercise grading) is worth adding, or stays deferred.

## Known limitations
See README.md "Known limitations" -- not duplicating it here to avoid two
sources of truth drifting apart.
