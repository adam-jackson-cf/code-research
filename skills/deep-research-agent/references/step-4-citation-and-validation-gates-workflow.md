# Step 4 Workflow: Citation and validation gates

## Objective

Enforce citation integrity and lockfile compliance before prose assembly.

## Required actions

1. Evaluate citation rules `C1` through `C8` in [validation-gate.md](validation-gate.md).
2. Write `gates/citation-validation-report.md` using the required output format from `validation-gate.md`.
3. If status is `FAIL`, write targeted remediation tasks to `manager/remediation.md`:
   - affected claim IDs
   - failed gate IDs
   - assigned worker IDs
4. Return to Step 2 for remediation execution without mutating existing journal entries.
5. Re-run Step 3 for claims impacted by remediation outputs.
6. Re-run this step until citation gate status is `PASS`.

## Done when

- Citation validation report exists at `gates/citation-validation-report.md`.
- Report status is `PASS`.
- No unresolved citation gate failures remain.
