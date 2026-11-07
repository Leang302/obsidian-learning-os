# Idea discovery, scope proposal, and scope change management

## Discovery (new idea)

Act as a product manager. Ask focused questions in small groups (2-4 at a
time, not twenty at once). Use `AskUserQuestion` for discrete choices,
plain conversation for open-ended ones. Cover, across however many rounds
it takes:

1. What problem this solves, for whom, and why now.
2. The 2-4 most important user workflows (not a full feature list yet).
3. Business domain basics: key entities, who interacts with the system.
4. Platform/tech preference, if any (don't force a stack choice they don't
   care about — propose a sensible default instead, see
   `reference/orchestration.md` → System Architect).
5. Expected scale (rough — "a few internal users" vs "public product").
6. Quality profile (`reference/modes.md`) if not obvious from the above.

While discussing, proactively surface (clearly labeled as **suggestions**,
never requirements):
- Features the idea implies but the user didn't mention.
- Business rules that will be needed (e.g. "what happens when a refund is
  requested after the invoice is paid?").
- Edge cases worth deciding now rather than discovering mid-build.
- Simpler alternatives if the stated approach looks overbuilt for the
  stated goal.
- Contradictions between stated goals and stated constraints.
- Cross-feature dependencies ("X needs Y to exist first").
- UX improvements that don't change scope.

## Scope proposal

Once you understand the idea well enough, write (in chat, not buried in a
file the user hasn't seen) a scope proposal with exactly these sections:

1. **Core features** — needed for the product to do its job at all.
2. **Optional features** — valuable but not essential for v1.
3. **Future features** — explicitly deferred, not forgotten.
4. **Excluded features** — considered and rejected, with why.
5. **Assumptions** — things you're proceeding on without explicit
   confirmation; call these out so the user can correct them.
6. **Unresolved decisions** — business-rule-level questions you need the
   user to answer (see `reference/requirements.md` for what counts).
7. **Important dependencies** — ordering constraints, external systems,
   things that block other things.

For each feature in core/optional, the user picks one of **INCLUDE /
EXCLUDE / LATER / MODIFY**. Don't proceed to requirements/implementation
until the user has approved the baseline (full approval isn't required for
every future change — see below — but the *initial* baseline needs it).

Once approved: write `docs/factory/scope.md` from
`templates/scope.md`, and seed `docs/factory/feature-inventory.md` with one
row per approved feature (status = APPROVED). Record the baseline date in
`docs/factory/decisions.md`.

## Existing codebase (no prior scope)

Inspect the repo before proposing anything: stack, structure, what
features already exist and work, what tests exist. Reconstruct a scope
proposal from what you find, but mark every inferred item `ASSUMED` rather
than `CONFIRMED` — the user needs to validate your read of their own
product. Use the same proposal structure above, with an extra note on
what you could not determine from code alone.

## Scope change management (ongoing)

When the user says "add this feature / remove this / change this rule /
move this to later / add a role / redesign this screen":

1. Restate your interpretation of the change in one or two sentences —
   confirm you understood it, don't just act.
2. Diff it against `docs/factory/scope.md` and `feature-inventory.md`.
3. Identify affected requirements (`requirements.md`), roles/permissions
   (`roles-permissions.md`), UI and backend dependencies
   (`dependency-map.md`), and database/migration implications
   (`data-model.md`).
4. Update `implementation-plan.md` to reflect the change.
5. Ask the user only for decisions that are genuinely theirs (see
   `reference/requirements.md`'s CONFIRMED/ASSUMED/PROPOSED/BLOCKED rule) —
   don't re-litigate things already decided unless this change reopens them.
6. Implement the approved change.
7. Update affected tests; run targeted tests, then the relevant regression
   subset (`reference/quality-engine.md`).
8. Update `requirements.md`, `feature-inventory.md`, `dependency-map.md`,
   `traceability.md`, `progress.md`.
9. Report: what changed, what's done, what's left, what (if anything) is
   still blocked.

**Removing a feature**: walk `dependency-map.md` for the feature and remove
or re-point every dependent nav entry, API route, permission grant, and
test — a removal that leaves a dead button or a 404'ing endpoint is not
done. Never delete user data or run a destructive migration as part of a
removal without explicit, separate confirmation from the user.

**Never let one change silently break another feature.** If a change
touches something `dependency-map.md` says another feature depends on,
that dependent feature's tests must be re-run before you call the change
complete, not just the changed feature's own tests.
