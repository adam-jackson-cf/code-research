# Reducer Merge Template

Use this block format when appending entries to `reducer/merge-log.md`.

```markdown
## Merge 0001
- utc: <YYYY-MM-DDTHH:MM:SSZ>
- worker_id: W01
- source_file: workers/W01/sources.ndjson
- claims_added: [C001, C002]
- claims_updated: [C003]
- conflicts_opened: [X001]
- tie_break_rule_applied: RULE-SOURCE-COUNT
- notes: <deterministic merge summary>
```

Rules:

- Merge IDs increase in lockfile worker order.
- Exactly one merge block is appended per worker per reducer pass.
- Tie-break rule name must match an entry in `manager/decision-rules.md`.
