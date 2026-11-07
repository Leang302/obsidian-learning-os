# Requirements engineering

## IDs (stable, never reused)

- Feature: `F-001`, `F-002`, ... assigned in `feature-inventory.md` at
  scope-approval time. Never renumber; a deferred/excluded feature keeps
  its ID.
- Requirement within a feature: `F-001-R01`, `F-001-R02`, ...
- Edge case: `F-001-E01`, ...
- Test: `F-001-T01`, ... (map 1:1 or many:1 to requirements/edge cases in
  `traceability.md`).

## Required content per feature

Write this into `requirements.md` for every approved feature:

- ID, name, one-line purpose / business value.
- Applicable roles (reference `roles-permissions.md`).
- User stories (as a `<role>`, I want `<capability>` so that `<value>`).
- Acceptance criteria — **testable**, not vibes. Bad: "the form works
  correctly." Good: "submitting the form with a past due date shows
  validation error E-DATE-PAST and does not create a record."
- Business rules, each tagged CONFIRMED / ASSUMED / PROPOSED / BLOCKED /
  DEFERRED (see below).
- Validation rules (field-level: required, format, range, uniqueness).
- Data requirements (entities/fields touched, see `data-model.md`).
- Dependencies on other features (→ `dependency-map.md`).
- UI requirements (screens/states touched, → `ux-spec.md`).
- API requirements (endpoints, request/response shape, → `architecture.md`).
- Security/permission requirements (who can do what, → `roles-permissions.md`).
- Scenarios: normal, error, empty state, loading state, boundary, recovery.
- Test scenarios (→ `test-matrix.md`).

## Classification of every business rule

- **CONFIRMED** — the user explicitly decided this.
- **ASSUMED** — you proceeded with a reasonable default; must be visibly
  flagged so the user can correct it before it's load-bearing.
- **PROPOSED** — your suggestion, not yet decided either way.
- **BLOCKED** — can't proceed without a user decision; do not implement
  around a BLOCKED rule by guessing.
- **DEFERRED** — intentionally postponed (feature is LATER, or rule only
  matters once some other thing exists).

Never silently convert ASSUMED/PROPOSED into CONFIRMED. Never invent an
important business policy and implement it as if settled.

## When to ask vs. when to just decide

**Ask the user** when the rule affects money, access/permissions, record
integrity, or is irreversible once live — e.g. "can a manager edit an
already-approved transaction?", "is a partial refund allowed?", "does
deleting a customer cascade-delete their orders?". These go in scope as
BLOCKED until answered, surfaced together in small batches, not one at a
time as they're discovered mid-implementation (batch them, continue other
work that doesn't depend on the answer).

**Just decide and document** (as ASSUMED) ordinary technical/implementation
detail — e.g. pagination page size, which library handles date formatting,
internal API response shape, retry backoff timing. Put it in `decisions.md`
and move on.

## Identifying unclear or conflicting requirements

Before implementing a feature, scan its acceptance criteria and business
rules for:
- Vague terms ("works correctly", "handles errors", "looks good") — rewrite
  as testable criteria, or flag BLOCKED if you can't without user input.
- Two rules that can't both be true for the same input — surface the
  conflict and ask which wins, don't silently pick one.
- A rule that assumes a dependency (another feature, an external system)
  that doesn't exist yet or isn't approved — flag in `dependency-map.md`
  and either sequence the work or mark BLOCKED.
