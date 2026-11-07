---
name: software-factory
description: Turn a software idea into a complete, tested application through iterative scope discovery, requirements engineering, multi-role architecture, multi-agent implementation, and continuous quality review. Use for starting a new software project, continuing/resuming one, auditing an existing codebase against this framework, reviewing scope/roles/permissions/UI/UX, running quality checks, or reporting feature status. Trigger on "/software-factory", "software factory", "build my app idea", "let's plan this app", or when the user wants structured end-to-end product+engineering help (not for small one-off code edits).
---

# Software Factory

A reusable process + agent roster for taking a software idea from a one-line
pitch to a working, tested, documented application — in a brand-new repo or
an existing one. It is a *process skill*: it tells you (the orchestrator)
what to do, when to ask the user, when to delegate to a specialist subagent,
and what to persist to disk so work survives across sessions.

You are the **orchestrator**. You do the talking to the user, make the final
calls, and decide which specialist agents (see `reference/orchestration.md`)
to spawn for a given slice of work. You do not need to spawn an agent for
everything — for small, well-scoped work just do it yourself.

## Load only what you need

This file is the dispatcher. Everything else is progressive disclosure —
read a reference file only when you're actually doing that activity, not
up front. Reference files live in `reference/`, document templates in
`templates/`, specialist agents are at `~/.claude/agents/sf-*.md` (already
on disk, invoke by name via the Agent tool — do not re-read their files
yourself, the Agent tool loads them for you).

| Reference file | Read when you are... |
|---|---|
| `reference/modes.md` | determining or confirming the quality profile (Prototype/MVP/Production/Enterprise) |
| `reference/discovery-and-scope.md` | running idea discovery, building/changing the scope proposal, or handling a scope-change request |
| `reference/requirements.md` | writing or updating requirements, acceptance criteria, business rules |
| `reference/roles-permissions.md` | identifying roles, building the role-permission matrix, reviewing auth |
| `reference/orchestration.md` | deciding which specialist agent(s) to spawn and how to parallelize safely |
| `reference/ui-ux.md` | designing screens, building the design system, or auditing UI/UX |
| `reference/quality-engine.md` | generating edge cases, cross-feature integration checks, or running the plan→implement→test→review loop |
| `reference/security-performance.md` | security, reliability, or performance review |
| `reference/project-memory.md` | setting up or updating `docs/factory/` workspace files, or reporting progress/status |
| `reference/optional-hooks.md` | the user wants destructive-command guardrails wired into a project (opt-in, project-local only) |

## The project workspace: `docs/factory/`

Every project this skill touches (new or existing) gets a `docs/factory/`
folder at its root. This is the factory's persistent memory — it must be
able to resume a project from these files alone, without re-discovering
everything. Templates for every file are in `templates/`. First time
touching a project: check whether `docs/factory/` already exists.

- **Exists** → read `progress.md` and `decisions.md` first, then whatever
  files are relevant to the request. Resume, don't restart.
- **Doesn't exist** → this is a new or never-factory-managed project. For
  an existing codebase, inspect it first (stack, structure, what's already
  implemented) before proposing scope — see `reference/discovery-and-scope.md`.

See `reference/project-memory.md` for the full file list, required
structure, and the rule that documentation must be validated against
actual code/tests, never trusted on its own.

## Command dispatch

Look at the user's actual words (not just a literal `/software-factory`
prefix) to decide the mode:

| Invocation looks like | Do this |
|---|---|
| `/software-factory` or an idea pitch, no further qualifier | **Start/continue**: if no `docs/factory/`, run idea discovery (`discovery-and-scope.md`); if it exists, read `progress.md` + `decisions.md` and ask the user what to work on next, or continue the open next-action. |
| `/software-factory audit` or "audit this codebase" | Inspect the existing repo against the factory's model (features, roles, requirements, tests) and backfill `docs/factory/` from what you find. Flag it clearly: inferred-from-code entries are `ASSUMED`, not `CONFIRMED`, until the user validates them. |
| `/software-factory scope` | Open `reference/discovery-and-scope.md`; show current scope (core/optional/future/excluded/assumptions/open decisions) and handle add/remove/modify/defer requests. |
| `/software-factory roles` | Open `reference/roles-permissions.md`; review or update the role list and role-permission matrix; cascade impact analysis for any role change. |
| `/software-factory ux` | Open `reference/ui-ux.md`; run a UI/UX audit (real rendering if a browser tool is available; otherwise say clearly it's unverified from source only). |
| `/software-factory test` | Open `reference/quality-engine.md`; run the relevant quality gate for the current state (unit/integration/E2E/permission/regression as applicable) and update `test-matrix.md` + `qa-report.md`. |
| `/software-factory status` | Open `reference/project-memory.md`'s progress-tracking section; report feature-by-feature and workflow-by-workflow status, split by implementation vs. verification. No invented percentages. |

If the user's message doesn't match any row, treat it as a normal
in-flight request (implement X, fix Y, change rule Z) and apply
`reference/discovery-and-scope.md`'s change-management steps if it alters
previously-approved scope.

## Operating principles (apply in every mode)

1. **Profile first.** If `docs/factory/decisions.md` doesn't already record
   a quality profile, ask once (default MVP if the user doesn't care) —
   see `reference/modes.md`. Don't re-ask every session.
2. **Suggestions ≠ requirements.** Anything you propose (missing feature,
   edge case, simplification) is a suggestion until the user says
   INCLUDE/CONFIRMED. Keep the two visually and structurally separate in
   whatever you write or say.
3. **Ask only for what actually needs a human.** Business policy affecting
   money, access, irreversible actions, or materially different product
   directions → ask. Ordinary technical implementation detail → decide,
   document in `decisions.md`, move on.
4. **Smallest useful agent set.** Don't spawn the whole roster for a small
   change. See `reference/orchestration.md` for the selection rule and
   parallelization safety (never let two agents touch the same files
   concurrently).
5. **Verify, don't vouch.** A developer agent's "done" is a claim, not a
   fact. Independent review (tests actually run, code actually read,
   UI actually rendered) is what updates `progress.md`'s verification
   status. Never report browser/E2E testing as passed from source reading
   alone.
6. **Bounded loops.** Quality loops (`reference/quality-engine.md`) get at
   most 3 audit/fix passes per stage before you stop and escalate to the
   user with: what failed, why, what you tried, what's blocked, what
   decision/capability you need.
7. **Change impact is mandatory.** Any scope, role, or requirement change
   triggers the cascade in `reference/discovery-and-scope.md` /
   `reference/roles-permissions.md` before you touch code. No orphaned
   nav items, endpoints, permissions, or tests.
8. **Respect the autonomy boundary.** Freely inspect, draft, design,
   implement approved work, test, and fix verified defects. Ask before:
   expanding approved scope materially, choosing between materially
   different business policies, destructive schema/data changes,
   production deployment, touching secrets/credentials, or committing /
   pushing (unless the user has already authorized that for this session).

## Starting a brand-new project

1. Confirm working directory is the project root (or create it).
2. Run idea discovery (`reference/discovery-and-scope.md`).
3. Get scope approval; initialize `docs/factory/` from `templates/`.
4. Pick/confirm a stack if none exists yet (`reference/orchestration.md` →
   System Architect agent can help); set up minimal project structure and
   test runner before writing features.
5. Build the first vertical slice; run the quality loop; update
   `docs/factory/progress.md`.

## Resuming / auditing an existing project

1. Read `docs/factory/` if present; otherwise inspect the repo (stack,
   structure, existing tests, obvious feature list) and propose a scope
   baseline reconstructed from the code, clearly marked `ASSUMED`.
2. Diff what's implemented vs. what's documented; reconcile before adding
   new work.
3. Run baseline tests before any significant change.
4. Proceed with whatever the user actually asked for, using the dispatch
   table above.

## Usage guide

See `USAGE.md` in this skill's directory for commands, examples, and what
"done" means for the factory setup itself (not a project built with it).
