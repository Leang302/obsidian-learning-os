# Multi-role architecture and permissions

## Identify roles from the actual domain

Don't apply a stock role list. For each project, derive roles from who
actually interacts with the system and what they're accountable for.
Common patterns (examples, not a checklist to force-fit): System Admin,
Owner, Manager, Employee, Accountant, Supplier, Customer, Viewer. A small
internal tool may genuinely need only one or two roles — don't invent more.

Record roles in `docs/factory/roles-permissions.md` with: name, purpose,
what distinguishes it from the nearest other role, and whether it's
org/tenant-scoped.

## The role-permission matrix

For every feature, record per role:
- View / Create / Edit / Delete / Approve / Export
- Access to financial or otherwise sensitive data
- Which records it can see (all / own / team / org-scoped)
- Whether it can assign or change others' permissions
- Which of its operations require a second role's approval

Default-deny: a role has no permission on a feature unless the matrix
explicitly grants one. When a new feature is added, add its row to the
matrix before implementation, not after.

## Enforcement model

Pick the lightest model that actually fits the domain; don't default to
the heaviest:
- **RBAC** — role alone determines access. Good default for most apps.
- **ABAC** — attributes of user/resource/context matter (e.g. "own org
  only", "only during business hours"). Use when RBAC can't express the
  actual rule.
- **Resource ownership** — a user can act on records they own, regardless
  of broader role.
- **Org/tenant boundaries** — hard isolation between tenants; every query
  must be scoped, no exceptions.
- **Approval workflows** — an action is provisional until a second role
  confirms it (see example workflow below).
- **Permission inheritance / role changes / revocation** — only model this
  if the domain has role hierarchies or users genuinely change roles over
  time; don't build it speculatively.
- **Audit logs** — required at Production+ for anything sensitive
  (financial, destructive, permission changes); optional at MVP unless the
  domain demands it (e.g. compliance-regulated data).

**Backend is the enforcement boundary, always.** Frontend hiding a button
is a UX nicety, never security. Every API handler that touches a
role-sensitive resource must check authentication, authorization, and
(when relevant) ownership/tenant scope server-side — no exceptions, no
"the UI won't let you do that" reasoning.

## Testing

- **Negative permission tests**: for every (role, action) pair the matrix
  denies, assert it's actually denied — at the API layer, not just "the
  button is hidden." Do this especially for the role one level below the
  one that's allowed.
- **Role-specific UI/navigation**: each role sees only the nav/actions it's
  entitled to.
- **Role-to-role handoff workflows**: trace a full cross-role sequence end
  to end. Example: Employee creates a transaction → Manager approves it →
  Accountant records payment → Owner reviews the report. Verify data is
  consistent at every handoff, not just that each step works in isolation.

## Change impact

- **New feature** → check whether the matrix needs new rows; don't ship a
  feature with an undefined (and therefore default-deny, which may be
  wrong) permission set — decide it explicitly.
- **New or removed role** → walk every feature row referencing it (or that
  should now reference a new role) and update; re-run the negative
  permission tests and the handoff workflows that involve the changed
  role.
