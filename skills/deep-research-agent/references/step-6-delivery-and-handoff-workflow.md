# Step 6 Workflow: Delivery and handoff

## Objective

Publish a complete, auditable deep-research package for decision use.

## Required actions

1. Verify required artifacts exist:
   - `manager/brief.md`
   - `manager/questions.md`
   - `manager/decision-rules.md`
   - `manager/role-lockfile.json`
   - `manager/role-lockfile.sha256`
   - `reducer/canonical-evidence.json`
   - `reducer/merge-log.md`
   - `reducer/conflicts.md`
   - `gates/citation-validation-report.md`
   - `gates/prose-quality-report.json`
   - `deliverables/report.md`
2. Recompute lockfile checksum and confirm it matches `manager/role-lockfile.sha256`.
3. Confirm `gates/citation-validation-report.md` and `gates/prose-quality-report.json` both report pass status.
4. Write `deliverables/handoff.md` with sections:
   - `Objective`
   - `Key Findings`
   - `Evidence Coverage`
   - `Open Conflicts`
   - `Knock-on Effects`
   - `Recommended Decisions`
5. Mark run completion in `deliverables/run-status.md` with `STATUS: COMPLETE`.

## Done when

- All required artifacts exist and checksum verification passes.
- Both gate reports are `PASS`.
- Handoff and run status files are complete.
