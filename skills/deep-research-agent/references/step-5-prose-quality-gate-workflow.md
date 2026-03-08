# Step 5 Workflow: Prose quality gate

## Objective

Convert validated claims into clear prose without changing evidence boundaries.

## Required actions

1. Draft `deliverables/report.md` from `reducer/canonical-evidence.json` and `reducer/conflicts.md`.
2. Evaluate prose with:

```bash
python3 scripts/prose_rubric_score.py --input-path deliverables/report.md --output-path gates/prose-quality-report.json --min-dimension 3 --min-overall 3.5
```

3. If status is `FAIL`, revise wording in `deliverables/report.md` and re-run this step.
4. If prose revisions require adding or removing claims, return to Step 3 before re-running this step.
5. Continue only when prose gate status is `PASS`.

## Done when

- Prose quality report exists at `gates/prose-quality-report.json`.
- Report status is `PASS`.
- Every substantive report claim references at least one reducer claim ID.
