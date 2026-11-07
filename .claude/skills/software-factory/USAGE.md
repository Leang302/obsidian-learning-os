# Software Factory — usage guide

A reusable Claude Code skill for taking a software idea (or existing
codebase) through scope discovery, requirements, multi-role architecture,
implementation, and a continuous quality loop. Installed at the user level
(`~/.claude/skills/software-factory/`), so it's available from any project
directory.

## Commands

Run these from inside the project you want the factory to work on (new or
existing repo). All of them are handled by the single `software-factory`
skill reading your message, not separate skills.

| Command | What it does |
|---|---|
| `/software-factory` | Start a new project (idea discovery → scope proposal) or resume an in-progress one (reads `docs/factory/progress.md`) |
| `/software-factory audit` | Inspect an existing codebase and reconstruct scope/requirements/feature inventory from it (marked ASSUMED until you confirm) |
| `/software-factory scope` | Review current scope; add/remove/modify/defer features |
| `/software-factory roles` | Review roles and the role-permission matrix |
| `/software-factory ux` | Run a UI/UX audit (real rendering if a browser tool is available, otherwise clearly marked unverified) |
| `/software-factory test` | Run the relevant quality gate (unit/integration/E2E/permission/regression) for current state |
| `/software-factory status` | Report feature and workflow status — implementation vs. verification, no invented percentages |

You can also just talk normally — "add a refund workflow", "what's left
before this is production-ready", "why does the manager role see this
screen" — the skill reads intent from your message, not just the literal
command.

## Example: starting your first project

```
/software-factory I want to build a small internal tool for my team to
track client invoices — who's paid, who's overdue, and let my accountant
export a monthly report.
```

This kicks off idea discovery: a few rounds of focused questions, a scope
proposal (core/optional/future/excluded/assumptions/open decisions) for
you to approve with INCLUDE/EXCLUDE/LATER/MODIFY per feature, then
`docs/factory/` gets created and implementation begins once you approve
the baseline.

## How scope approval works

Nothing gets implemented from a *suggestion* — only from something you've
marked INCLUDE/CONFIRMED. The initial scope baseline needs your explicit
approval before any code is written. After that, ongoing changes
("add X", "remove Y") go through the same INCLUDE/EXCLUDE/MODIFY framing,
but don't require re-approving the whole baseline each time — just the
specific change and its surfaced BLOCKED decisions.

## How multi-role requirements work

The factory identifies roles from your actual domain (not a fixed list),
builds a role-permission matrix per feature (view/create/edit/delete/
approve/export/financial-access/record-scope), and enforces it server-side
by design — frontend visibility is never treated as security. Every role
change or new feature triggers a pass to check whether the matrix needs
updating, and cross-role workflows (e.g. employee creates → manager
approves → accountant records) get tested end to end, not just per-screen.

## How the audit/fix loop works

`PLAN → IMPLEMENT → TEST → REVIEW → FIND GAPS → FIX → RETEST → AUDIT
INTEGRATION → VERIFY ACCEPTANCE CRITERIA`, capped at 3 fix passes per
stage. If something's still broken after 3 passes, the factory stops and
reports what failed, why, what was tried, and what decision or capability
it needs from you — it will not loop forever or claim success it hasn't
verified.

## Resuming an interrupted project

Just run `/software-factory` (or ask directly) in the project directory.
The skill reads `docs/factory/progress.md` and `decisions.md` first and
picks up from there — it does not re-run discovery on a project that
already has an approved scope, and it does not re-ask decisions already
marked CONFIRMED.

## What's actually verified about this setup

Verified: the skill file is installed with valid frontmatter at the
correct user-level path and is recognized by this Claude Code install (it
appeared in this session's available-skills listing immediately after
creation); all 12 specialist agent files are written with valid frontmatter
at `~/.claude/agents/`; all 16 `docs/factory/` templates and 9 reference
files exist and are internally cross-referenced; no existing skills, agents,
or global settings were modified or overwritten.

Not verified (requires actually running a project through the factory):
agent-to-agent handoff behavior in a live multi-agent run, browser-based
UI/UX auditing (no browser tool was exercised during setup), and the
optional guardrail hook's behavior in a real shell (the snippet is
documented but not installed anywhere — it's opt-in per project).

## Known limitations

- This is a process/orchestration layer, not a code generator with a fixed
  template — output quality still depends on the orchestrator (you, when
  using it) making good calls on when to ask the user vs. decide.
- The optional destructive-command hook is a coarse pattern match, not a
  real security boundary, and is never installed automatically.
- Nothing here runs the four quality profiles' full checklists
  automatically on a timer — each pass is triggered by you or by the
  orchestrator's own judgment during a task.
