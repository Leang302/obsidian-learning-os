# Persistent project memory: `docs/factory/`

Every project gets this workspace at its root. It must be sufficient to
resume the project cold, in a new session, without re-discovering
everything. Code and test results validate the documentation — the
documentation alone is never proof that something is implemented.

## Files (seed from `templates/` at scope approval; create on first need)

| File | Purpose |
|---|---|
| `scope.md` | Core/optional/future/excluded features, assumptions, dependencies — the approved baseline |
| `requirements.md` | Per-feature requirements, acceptance criteria, business rules (see `reference/requirements.md`) |
| `decisions.md` | Every CONFIRMED/ASSUMED decision with date and rationale; quality profile record |
| `roles-permissions.md` | Role list + role-permission matrix |
| `architecture.md` | Stack, API design, data flow, integration points |
| `data-model.md` | Entities, relationships, constraints, migrations log |
| `ux-spec.md` | Design system + screen inventory |
| `feature-inventory.md` | One row per feature: ID, name, status (see state model below) |
| `dependency-map.md` | Requirement/role/screen/API/table/test cross-links |
| `implementation-plan.md` | Current plan of record for in-flight work |
| `traceability.md` | Requirement → test mapping |
| `edge-cases.md` | Edge cases per feature with ID and resolution/test |
| `test-matrix.md` | Test coverage per feature, by test type |
| `qa-report.md` | Findings from quality/security/UX audits, each tagged CONFIRMED/UNVERIFIED |
| `progress.md` | Current status, split implementation vs. verification; blockers; next actions |
| `release-readiness.md` | Production/Enterprise go/no-go checklist |

Keep each file concise and structured (tables over prose where it fits).
Use stable IDs everywhere (`reference/requirements.md`). If two files would
otherwise disagree on the same fact, one of them shouldn't contain it —
pick a single source of truth and reference it from the other.

## Feature status state model

Implementation states: `PROPOSED → APPROVED → DESIGNED → IMPLEMENTING →
IMPLEMENTED`. Separately, verification states: `TESTING → VERIFIED`, or
`BLOCKED` / `DEFERRED` at any point. Track both independently in
`feature-inventory.md` and `progress.md` — "implemented" is not "verified."

Example row:
```
Feature: Customer Credit (F-014)
Implementation: Complete
Unit Tests: Passed        Integration Tests: Passed
E2E Tests: Not Run        Security Review: Passed
UX Review: Pending
Overall: NOT FULLY VERIFIED
```

## Reporting (`/software-factory status`)

Report by feature and by cross-feature workflow. No invented completion
percentages — report actual state per the model above, plus any blockers
and the next concrete action. If something failed or stalled, say so
plainly rather than rounding up.

## Resuming

On touching a project, read `progress.md` and `decisions.md` first. Don't
re-ask the user things already CONFIRMED there. Don't re-run a full
discovery pass on a project that already has an approved `scope.md`.
