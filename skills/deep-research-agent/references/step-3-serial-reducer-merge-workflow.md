# Step 3 Workflow: Serial reducer merge

## Objective

Merge worker outputs into one deterministic claim set using strict lockfile order.

## Required actions

1. Read worker IDs from `manager/role-lockfile.json` in listed order.
2. Verify each worker has a `status_complete` event in `workers/<worker_id>/journal.jsonl`; block merge if any worker is incomplete.
3. Initialize reducer artifacts if absent:
   - `reducer/canonical-evidence.json`
   - `reducer/merge-log.md`
   - `reducer/conflicts.md`
4. Run deterministic merge in one reducer process:

```bash
python3 scripts/reduce_worker_journals.py --journal-path workers/W01/journal.jsonl --journal-path workers/W02/journal.jsonl --output-path reducer/canonical-evidence.json
```

5. Append merge record to `reducer/merge-log.md` using [../assets/templates/reducer-merge-template.md](../assets/templates/reducer-merge-template.md).
6. Apply tie-break rules from `manager/decision-rules.md` in declared order for every conflict.
7. Append unresolved conflicts to `reducer/conflicts.md` with conflict IDs (`X001`, `X002`, ...); do not delete conflicting claims.
8. Write incremental snapshots after each merge run:
   - `reducer/synthesis-pass-01.md`
   - `reducer/synthesis-pass-02.md`
   - `reducer/synthesis-pass-<nn>.md`
9. Do not parallelize reducer writes; one reducer operation runs at a time.

## Done when

- Worker outputs are merged in lockfile order without reordering.
- `reducer/canonical-evidence.json` contains stable claim IDs and source links.
- `reducer/merge-log.md` records every worker merge.
- `reducer/conflicts.md` contains every unresolved conflict.
