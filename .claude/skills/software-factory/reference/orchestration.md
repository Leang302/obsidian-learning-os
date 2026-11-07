# Multi-agent orchestration

You (the orchestrator) own coordination, final decisions, and integration.
Specialist agents are defined at `~/.claude/agents/sf-*.md` and are invoked
with the `Agent` tool by name (e.g. `subagent_type: "sf-backend-engineer"`).
Use `subagent_type: "fork"` instead of a specialist when you just need more
of *your own* context-heavy exploration done in the background.

## Roster and when to reach for each

| Agent | Spawn it for | Not for |
|---|---|---|
| `sf-product-manager` | Scope discovery, completeness-checking requirements, acceptance criteria, feature dependency surfacing | implementation |
| `sf-business-analyst` | Detailed workflow/state-transition modeling, domain edge cases, finding requirement contradictions | UI design, code |
| `sf-system-architect` | Overall architecture, API/data-flow design, stack selection for a new project, scalability tradeoffs | writing feature code |
| `sf-database-architect` | Schema design, constraints/relationships, transaction boundaries, migrations, data integrity | API contracts, UI |
| `sf-ui-ux-designer` | User journeys, screen structure, navigation, design system, interaction/responsive behavior | writing component code |
| `sf-frontend-engineer` | Implementing components, forms/validation, state management, role-based UI, wiring to APIs | backend logic, schema |
| `sf-backend-engineer` | APIs, domain logic, security enforcement, transactions, integrations | UI, design system |
| `sf-security-auditor` | Reviewing authz, data leakage, input validation, secrets handling, abuse cases | implementing fixes (hand findings back) |
| `sf-qa-engineer` | Writing/running unit, integration, E2E, edge-case, and regression tests | implementing the feature under test |
| `sf-ux-auditor` | Visual consistency, usability, accessibility, responsive behavior, friction points — independent of the designer who built it | designing the thing it audits |
| `sf-integration-auditor` | Cross-feature consistency, frontend/backend alignment, data lifecycle, broken dependencies after a change | single-feature review |
| `sf-devops-engineer` | Build checks, env config, CI, deployment readiness, rollback considerations | feature implementation |

## Selection rule

Pick the smallest set that actually covers the task. A one-field bug fix
needs you, not five agents. A new vertical-slice feature at MVP typically
needs: architect/DB (if schema changes) → frontend + backend (can run in
parallel once contracts are set) → QA → you integrate. Production/
Enterprise work adds security-auditor and integration-auditor passes before
calling it verified.

## Parallelization safety

- Parallelize only genuinely independent work (e.g. frontend component work
  and backend endpoint work against an already-agreed contract; or
  reviewing two unrelated features).
- Never let two agents edit the same file concurrently. If two slices touch
  a shared file (e.g. a shared router or schema file), sequence them.
- Agree the contract first (API shape, schema) before parallelizing
  frontend/backend so neither is guessing at the other's interface.
- Reviewers (security/QA/UX/integration auditors) should evaluate
  independently — give them the requirement/acceptance criteria and let
  them inspect the actual code/running app, not the implementer's summary
  of what they did.

## Conflict resolution

When two agents' findings disagree (e.g. security auditor flags something
QA says is fine), you resolve it — don't just report both and stop. If you
can't resolve it confidently, surface it to the user as an unresolved
decision rather than picking one arbitrarily.

## What to hand each agent

Always give a spawned agent: the relevant requirement ID(s) and acceptance
criteria, the quality profile in effect, any constraints from
`decisions.md` that bind this work, and — for reviewers — explicit
instructions to verify independently (run it, read it, don't trust a
summary). Fresh agents have no memory of this conversation; brief them like
a competent colleague who just walked in, not a one-line command.
