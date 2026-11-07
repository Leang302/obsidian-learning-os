# Quality profiles

Ask the user which profile applies if `docs/factory/decisions.md` doesn't
already record one. Default to **MVP** if they have no preference. Record
the choice in `decisions.md` as CONFIRMED with the date. Re-confirm only if
the user explicitly asks to change it or the project's stakes visibly shift
(e.g. "this is going live to real customers now").

Do not apply a higher profile than the project needs. A prototype asked to
validate an idea does not need migration strategy and threat modeling.

## PROTOTYPE
- Goal: fast idea validation, not production code.
- Mock/seeded data allowed, but must be visibly labeled as mock in the UI
  or a README — never silently fake.
- Basic workflows only; skip rare edge cases unless they'd mislead the user
  about whether the idea works.
- Attractive, functional UI — still run the UI/UX checklist, just lighter.
- Minimal infra: local dev only, no deployment pipeline needed unless asked.
- Tests: smoke-level only (does the golden path work).

## MVP (default)
- Real, working essential workflows end-to-end (UI → API → DB).
- Essential validation and permission checks — not exhaustive, but nothing
  a real first user would hit as broken or insecure.
- Working database and APIs, not mocked.
- Critical-path automated tests (happy path + the failure modes a user will
  actually hit).
- Responsive, consistent UI using one coherent design system.
- Security: basic auth/authz correct; skip advanced threat modeling.
- No formal migration/rollback strategy required yet, but don't write
  migrations that would be painful to evolve later.

## PRODUCTION
- Full `reference/security-performance.md` security review.
- Proper authentication/authorization, least privilege, secrets handled
  correctly.
- Migration strategy: every schema change is a reviewable, reversible
  migration.
- Integration tests across features, plus a regression suite that runs
  before merge.
- Monitoring/error handling: errors are logged with enough context to
  debug in production; failures degrade gracefully, not silently.
- Performance review for the project's actual expected scale (don't invent
  scale requirements the user didn't state).
- Deployment readiness checklist before calling anything releasable
  (see `templates/release-readiness.md`).

## ENTERPRISE
Everything in Production, plus:
- Advanced permissions: ABAC/resource-ownership/org-tenant boundaries where
  the domain calls for it, plus audit logging of sensitive actions.
- Deeper threat modeling for the project's actual attack surface (don't
  pad with generic threats that don't apply).
- Concurrency and data-integrity controls: optimistic/pessimistic locking,
  idempotency keys, transaction boundaries explicitly reviewed.
- Integration reliability: retries, timeouts, partial-failure handling for
  every external dependency.
- Operational recovery: backup/restore expectations, rollback plan for
  releases, documented runbook for known failure modes.
- Strongest quality gates: all Production gates plus negative permission
  tests for every role pair, full traceability from requirement to test.

## How profile affects other reference files

- `reference/quality-engine.md` edge-case catalog: apply all categories at
  Production/Enterprise; apply only the categories relevant to validating
  the idea at Prototype/MVP.
- `reference/roles-permissions.md`: RBAC is enough for MVP in most domains;
  ABAC/tenant boundaries/audit logs are Production+ unless the domain
  inherently needs them sooner (e.g. multi-tenant SaaS from day one).
- `reference/security-performance.md`: full checklist is Production+;
  MVP gets the "doesn't get immediately popped" subset.
