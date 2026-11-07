# Security, reliability, performance, and maintainability

Full depth applies at Production/Enterprise (`reference/modes.md`); at
MVP apply the subset that prevents an obvious, immediate problem; at
Prototype skip unless the prototype handles real user data.

## Security and reliability review

- Authentication and session handling correctness.
- Authorization enforced server-side for every role-sensitive operation
  (see `reference/roles-permissions.md` — this is not optional at any
  profile above Prototype).
- Password/secret handling: hashed/salted passwords, secrets never in
  source control or logs, least-privilege service credentials.
- Input validation at every trust boundary (not just client-side).
- Common web vulnerabilities: injection (SQL/NoSQL/command), XSS, CSRF,
  SSRF, insecure deserialization, broken access control — check for the
  ones actually relevant to the stack in use.
- Sensitive data exposure: no secrets/PII in logs, error messages, or
  client-visible payloads beyond what's needed.
- Auditability for sensitive actions at Production+ (who did what, when).
- Transaction integrity, idempotency for retried requests, sane retry/
  backoff behavior for external calls.
- Concurrency: identify where two simultaneous operations could corrupt
  state and whether locking/versioning handles it.
- Data isolation between users/orgs/tenants where applicable.
- Backup/recovery expectations documented at Production+ (even if the
  actual backup infra is out of scope, the requirement should be stated).
- Dependency security: flag known-vulnerable or abandoned dependencies
  when you notice them; don't do a full audit unless asked.
- Migration safety: every schema migration should be reviewable and, where
  feasible, reversible; never silently drop or truncate data in a migration.

Never perform production deployment, destructive data operations,
credential rotation, or external financial actions without the user's
explicit, specific approval for that action.

## Performance and maintainability

Review what's relevant to the project's actual stated or implied scale —
don't invent scale requirements, and don't optimize a hypothetical
bottleneck at the cost of simplicity.

- Database: indexed access patterns for hot queries, pagination for list
  endpoints, no N+1 query patterns in a hot path.
- API performance: response times reasonable for the data volumes in play.
- Frontend: avoid unnecessary re-renders/large bundle bloat for the
  project's scale; lazy-load what's genuinely large.
- Caching only where there's a measured or obvious need.
- Logging/observability: enough to debug a production issue after the
  fact, without logging sensitive data.
- Code duplication and module boundaries: flag during review, fix when
  it's cheap, don't block a release over it unless it's actively causing
  bugs.
- Test maintainability: tests should fail for a clear reason, not be
  brittle to incidental implementation details.

Set measurable goals sized to the project (e.g. "list endpoint returns in
under 500ms for the expected row counts") rather than generic targets that
don't connect to this project's actual scale.
