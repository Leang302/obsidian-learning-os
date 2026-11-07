# Edge cases, cross-feature integration, the quality loop, and journey simulation

## Automated edge-case catalog

For every feature, check which of these categories actually apply to its
domain (don't force-fit irrelevant ones — e.g. currency rounding doesn't
apply to a feature with no money) and write the relevant ones into
`docs/factory/edge-cases.md` with an ID (`F-00x-E0y`), then a test for each
one that matters at the current quality profile (`reference/modes.md`).

- **Input**: missing values, invalid values, wrong format, boundary values,
  extremely large values, duplicate submissions.
- **State**: invalid transitions, repeated actions, cancelled mid-flow,
  partial completion, interrupted workflows.
- **Data**: missing related records, deleted references (dangling FK),
  stale reads, concurrent modification, transaction rollback, duplicate
  requests (idempotency).
- **Security**: unauthorized users, wrong role, cross-user data access,
  cross-org/tenant access, privilege escalation attempts.
- **Integration**: external API failure, timeout/retry, network
  interruption, partial service failure, resulting inconsistent state.
- **UI**: empty lists, very long text, large datasets (pagination/virtual
  scroll), disabled-action states, validation feedback clarity, loading
  and failure states, small screens.
- **Business**: conflicting rules, date/timezone boundaries, currency
  rounding, partial payments, approval reversals, duplicate financial
  operations — only the ones relevant to the actual domain.

Edge cases that imply a product decision (not just an engineering one) go
to the user as BLOCKED business rules (`reference/requirements.md`), not
silently resolved.

## Cross-feature integration engine

Maintain `docs/factory/dependency-map.md` connecting requirements, roles,
screens, components, APIs, services, DB tables, events/integrations, and
tests. For every new or changed feature, before calling it done:

1. Identify affected modules and dependent features from the map.
2. Identify permission, data, and UI/UX impacts.
3. Identify existing tests that need updating and new scenarios needed.
4. Re-validate related workflows that cross the changed feature, not just
   the feature in isolation.

Watch specifically for: orphaned UI actions (button with no working
handler), missing backend implementations for a documented API, calculation
inconsistencies between screens showing the "same" number, broken
navigation.

## Quality loop

```
PLAN -> IMPLEMENT -> TEST -> REVIEW -> FIND GAPS -> FIX -> RETEST
     -> AUDIT INTEGRATION -> VERIFY ACCEPTANCE CRITERIA
```

Exit conditions (all must hold to call a stage done):
- Every approved acceptance criterion for the feature is satisfied.
- No unresolved critical defect.
- Relevant automated tests passing (unit/integration/E2E as applicable to
  the profile).
- Role/permission tests passing (including negative tests).
- Cross-feature flows touching this feature verified.
- Required UI states implemented (empty/loading/error/success).
- No known breaking regression.
- Required build checks passing.

**Bounded passes**: at most 3 audit/fix cycles per stage. If problems
remain after 3, stop and report to the user: what failed, why, what you
tried, what's blocked, and what decision or capability you need — don't
keep looping hoping it resolves itself, and don't declare success anyway.

"Looks fine" is never sufficient evidence. Use actual test execution,
actual source inspection, actual rendered UI (`reference/ui-ux.md`) where a
tool allows it.

## Real user journey simulation

For important multi-role or multi-feature workflows, before marking them
verified, trace the full sequence: initial state → login as role A →
navigate → enter data → validate → submit → backend processing → DB
change → dependent feature updates → a second role interacts with the
result → an error/recovery case along the way. Check both what's displayed
and what's actually persisted (query the DB/fixture, don't just trust the
success toast).

Use controlled fixtures or a test database. Never run destructive journey
tests against real/production data.

## Progress vs. verification

Update `docs/factory/progress.md` and `test-matrix.md` to separate
*implementation* status from *verification* status per feature (see
`reference/project-memory.md` for the exact state model) — "implemented"
and "verified" are not the same claim.
