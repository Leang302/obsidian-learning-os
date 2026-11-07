# Learning OS for Obsidian

An AI-powered personal learning system that lives inside Obsidian: it
generates a curriculum for whatever you want to learn, teaches it lesson by
lesson with a context-aware AI tutor chat, grades practice exercises, and
tracks real progress (completed vs. *mastered*) -- all stored as plain
Markdown in your vault.

> Markdown is the source of truth. The UI makes learning intuitive. The AI
> acts as a teacher. Context retrieval is local-first and token-budgeted.

## Status

This is a working vertical slice: **Start Topic → Roadmap → Lesson Reader →
AI Teacher Chat → Exercise grading → Progress persistence → Next-lesson
recommendation**, plus a Progress & Review view. See
`docs/factory/progress.md` for exactly what's implemented vs. verified, and
what's still missing before calling this "done."

**Important — not yet verified**: this has been type-checked, bundled, and
covered by unit tests on pure logic (see `tests/`), but has **not** been
run inside an actual Obsidian window in this environment (no GUI/Electron
available here). Please load it into a real (ideally test) vault and
sanity-check the five views before trusting it with content you care about.

## Install (for development / manual testing)

### Easiest: use the included test vault

This repo already contains `test-vault/` -- a throwaway Obsidian vault with
this plugin pre-linked and pre-enabled. Nothing to configure or symlink
yourself:

1. `npm install && npm run build`
2. In Obsidian: **File → Open folder as vault** → select this project's
   `test-vault` folder.
3. If Obsidian shows a "community plugins are disabled" / restricted-mode
   banner, click to turn community plugins on (Obsidian requires this
   confirmation itself; it can't be pre-set from disk). "Learning OS"
   should then already be enabled in Settings → Community plugins.
4. Settings → Learning OS: pick a provider and paste an API key, then
   "Test connection".
5. Click the graduation-cap ribbon icon → "Start New Topic".

While developing, run `npm run dev` instead of `npm run build` -- it
rebuilds `main.js` automatically on save (symlinked into the test vault,
so changes apply after you reload the plugin: Settings → Community
plugins → toggle Learning OS off/on, or just restart Obsidian).

### Using your own existing vault instead

If you'd rather test in a vault you already have:
```bash
VAULT=/path/to/your/vault
mkdir -p "$VAULT/.obsidian/plugins/learning-os"
ln -sf "$(pwd)/manifest.json" "$VAULT/.obsidian/plugins/learning-os/manifest.json"
ln -sf "$(pwd)/main.js" "$VAULT/.obsidian/plugins/learning-os/main.js"
ln -sf "$(pwd)/styles.css" "$VAULT/.obsidian/plugins/learning-os/styles.css"
```
Then enable it in Settings → Community plugins, same as above.

## Sharing this with another user (via BRAT)

Once this is pushed to a GitHub repo and a version tag (e.g. `v0.1.0`) is
released -- the included `.github/workflows/release.yml` does the build
and attaches `manifest.json`/`main.js`/`styles.css` to the GitHub Release
automatically on tag push:

1. The other person installs **BRAT** (Obsidian42 - BRAT) from Obsidian's
   community plugin browser, in their own vault.
2. Settings → BRAT → "Add Beta plugin" → enter `owner/repo` (e.g.
   `yourname/learning-os`).
3. If the repo is **private**, they'll also need a GitHub personal access
   token with `repo` read scope, entered in BRAT's settings -- BRAT
   supports this for private repos, it just needs that extra step since
   GitHub won't serve release assets from a private repo without auth.
4. BRAT installs it and auto-enables it; future pushes of a new tag show
   up as an update in BRAT, no manual file-sending needed.
5. They still need their **own** AI provider API key -- nothing here is
   shared between users; each person's key and vault content stay local
   to them (see "Known limitations" below).

## How it's organized

```
LearningOS/
  Topics/<topic-id>/
    Overview.md     topic goal, level, subject kind
    Roadmap.md       modules + their status
    Progress.md      per-lesson status, mastered/weak concepts
    Lessons/<id>.md  one file per lesson (generated on first open)
    Exercises/<lesson>-<exercise>.md   durable attempt log per exercise
```

Everything here is plain Markdown with YAML frontmatter for structured
fields. Delete the plugin and these files are still fully readable notes.

## Architecture (see `docs/factory/` for the full write-up)

- `src/data/` -- Markdown read/write layer (`VaultStore`, `Repository`),
  safe writes with mtime-based conflict checks, frontmatter parsing that
  never throws on malformed YAML.
- `src/retrieval/` -- local-first keyword index over `LearningOS/` only,
  incremental on vault changes, plus the context-assembly pipeline that
  enforces a token budget and never silently truncates a kept passage.
- `src/ai/` -- provider adapter interface (`AIProvider`) with concrete
  Anthropic and OpenAI-compatible implementations; conversation memory
  (recent window + rolling summary) kept in memory only, never written
  verbatim to the vault.
- `src/curriculum/` -- curriculum generation, lazy per-lesson content
  generation, the tutor orchestrator (retrieval → prompt → stream), and
  all prompt templates (including the "retrieved context is data, not
  instructions" grounding rule).
- `src/progress/` -- pure, deterministic mastery/review-scheduling logic
  (`reviewScheduler.ts`) -- fully unit tested, no AI call involved.
- `src/views/` -- the five UI surfaces (Dashboard, Roadmap, Lesson Reader +
  Chat, Progress & Review), built with Preact, styled with Obsidian's
  theme variables (`styles.css`) for light/dark support.

## Known limitations (read before relying on this)

- **No real Obsidian-runtime verification yet** (see Status above).
- Single-user, desktop-only (Electron); mobile Obsidian isn't targeted.
- API keys are stored in the plugin's `data.json`, in plain text -- that's
  the only persistence mechanism an Obsidian plugin has. It is not a
  keychain. Don't use a key you can't afford to have exposed if your vault
  sync/backup isn't encrypted.
- Retrieval is keyword/heading-based, not semantic/embeddings-based, by
  design (see `docs/factory/decisions.md`) -- it's intentionally the
  "add only if needed" case, unverified in practice yet since no real
  usage has happened.
- Conflict detection on writes is best-effort (fresh-read-then-write, plus
  mtime checks on the raw `write()` path) -- adequate for a single-user
  local vault, not a guarantee against a true simultaneous edit.
- No formal assessment/quiz flow beyond single-exercise grading yet
  (`AssessmentResult` exists in the type model and feeds mastery scoring,
  but nothing currently generates a multi-question assessment UI).
- The AI Context Inspector is wired into the Lesson chat panel but hasn't
  been visually verified in a running Obsidian window.
