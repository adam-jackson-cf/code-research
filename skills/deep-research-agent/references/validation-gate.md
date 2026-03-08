# Validation Gate

Use this gate after Step 4 and Step 5. Gate output must be binary: `PASS` or `FAIL`.

## Citation gate rules

- `C1` Claim identity:
  - every claim in `reducer/canonical-evidence.json` has `claimId` matching `C[0-9]+`.
- `C2` Source cardinality:
  - every claim references at least 2 source IDs.
- `C3` Source independence:
  - referenced sources for a claim come from at least 2 unique domains.
- `C4` Journal traceability:
  - every source ID resolves to one `eventId` in the matching worker journal.
- `C5` Source metadata completeness:
  - each source record includes `source_id`, `question_id`, `url`, `title`, `publisher`, `published_utc`, `captured_utc`, `worker_id`, and `journal_event_id`.
- `C6` Recency compliance:
  - `published_utc` falls inside `recency_window_days` from `manager/brief.md`, or a waiver entry exists in `manager/decision-rules.md`.
- `C7` Conflict accounting:
  - every unresolved reducer conflict is listed in `reducer/conflicts.md` with a conflict ID.
- `C8` Lockfile compliance:
  - every source and claim is attributable to a worker-question assignment in `manager/role-lockfile.json`.

## Prose gate rules

- `P1` Claim-first structure:
  - each paragraph in `deliverables/report.md` starts with a direct claim sentence.
- `P2` Citation coverage:
  - each substantive claim sentence ends with at least one reducer citation token (`[C###]`).
- `P3` Citation integrity:
  - every cited claim ID exists in `reducer/canonical-evidence.json`.
- `P4` Conflict disclosure:
  - every unresolved conflict ID appears in an `Open Conflicts` section.
- `P5` Sentence-length discipline:
  - average sentence length is between 12 and 28 words.
- `P6` Language precision:
  - reject sentences that rely on unqualified fillers (`very`, `obviously`, `clearly`, `probably`) without evidence tokens.

## Evaluation procedure

1. Evaluate `C1` through `C8` in order and record evidence lines.
2. If any citation gate fails, return `FAIL` and skip prose evaluation.
3. Evaluate `P1` through `P6` only after citation gates pass.
4. Return `PASS` only when every evaluated gate passes.

## Required output format

```text
VALIDATION_STATUS: PASS|FAIL
FAILED_GATES: <comma-separated gate IDs or NONE>
EVIDENCE:
- C1: <evidence>
- C2: <evidence>
- C3: <evidence>
- C4: <evidence>
- C5: <evidence>
- C6: <evidence>
- C7: <evidence>
- C8: <evidence>
- P1: <evidence or SKIPPED>
- P2: <evidence or SKIPPED>
- P3: <evidence or SKIPPED>
- P4: <evidence or SKIPPED>
- P5: <evidence or SKIPPED>
- P6: <evidence or SKIPPED>
CORRECTIVE_ACTIONS:
- <required fix 1>
- <required fix 2>
```
