# Optional guardrail hook (opt-in, project-local only)

The factory never edits the user's **global** `~/.claude/settings.json` —
that would change Bash behavior for every unrelated project/session
without the user asking for it. Instead, when a Production/Enterprise
project wants a safety net for the irreversible actions called out in
`reference/security-performance.md` (production deploy, destructive SQL,
force-push, credential rotation), offer to add a **project-local**
`.claude/settings.json` hook — only if the user says yes.

This hook is a stateless `PreToolUse` matcher on `Bash` that pattern-checks
the command against a short deny-list and blocks (exit code 2) with an
explanation, requiring the user to re-approve explicitly. It cannot loop
(it runs once per tool call, does nothing on allow) and it never executes
anything itself — it only inspects the proposed command string.

## Snippet to merge into the project's `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cmd=$(cat | jq -r '.tool_input.command // \"\"'); if echo \"$cmd\" | grep -Eiq 'drop +table|truncate +table|delete +from .*;? *$|git +push +--force|git +reset +--hard|rm +-rf +/|terraform +apply|kubectl +delete|--prod|production'; then echo 'Blocked by software-factory guardrail: this looks like a destructive/production action. Re-run only after explicit user confirmation of this exact command.' >&2; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

Notes:
- This is a coarse pattern match, not a security boundary — it's a second
  "are you sure" for the obvious cases, not a substitute for judgment.
  Expect and accept some false positives; the user can always confirm and
  the agent will explain why it paused.
- Merge it into the existing `.claude/settings.json` (don't overwrite other
  hooks/permissions already there) using `jq` or by reading the file first.
- Tell the user it's active and where, so it isn't a surprise later.
- Remove it the same way (edit the file, don't blow away the whole hooks
  key) if the user asks.
