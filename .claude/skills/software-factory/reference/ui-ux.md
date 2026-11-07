# UI/UX design quality

## Design system (define once per project, in `docs/factory/ux-spec.md`)

Choose a visual direction that fits the product (don't default to generic
if the product calls for something distinctive), then define, consistently
across every screen:

Color palette, typography, spacing/layout grid, navigation pattern,
buttons, form components, tables/filters, dialogs/drawers, cards/
dashboards, notifications, icon set, error feedback, empty states, loading
states, success states, responsive behavior, accessibility (contrast,
focus order, ARIA where applicable), keyboard navigation.

If this session has a `dataviz` skill available and the project includes
charts/dashboards, load it before building those — don't freehand chart
styling.

## Per-screen analysis

Before building or reviewing any screen, answer:
- Who uses it (which role(s))?
- What is its one main purpose?
- What actions are available, and is the most common one the easiest to
  find?
- What information is essential vs. nice-to-have (don't clutter)?
- What can go wrong here, and does the screen handle it gracefully?
- What happens immediately after each action (confirmation, navigation,
  nothing)?
- Is navigation consistent with the rest of the app?
- Would someone using this app for the first time understand it without
  help?

Minimize unnecessary clicks and repeated data entry — if two screens need
the same data, don't make the user retype it.

## Verification — never claim what you didn't check

- If a browser/screenshot tool is available: actually render the screen,
  check desktop and mobile layouts, inspect loading/empty/error states by
  triggering them, not just reading the code that should produce them.
- If no browser tool is available: say explicitly "UI/UX unverified —
  reviewed from source only" in `qa-report.md` and to the user. Do not
  report a visual pass based on source inspection alone.
- `sf-ux-auditor` should review independently of whoever built the screen,
  using the same per-screen questions above.

## UX audit checklist (`/software-factory ux`)

1. Re-render every screen touched since the last audit (or the whole app
   on a first audit).
2. Check consistency against the design system — flag any one-off styling.
3. Check accessibility basics: contrast, keyboard reachability, focus
   visibility, alt text / labels on interactive elements.
4. Check responsive behavior at common breakpoints.
5. Check that every action has a visible result (success/error/loading).
6. Check empty states exist and are helpful, not blank or a raw "[]".
7. Record findings in `docs/factory/qa-report.md`, each tagged
   CONFIRMED (you verified it) or UNVERIFIED (no tool to check).
