# Step 0 Workflow: Preflight and brief lock

## Objective

Freeze scope, question inventory, and tie-break logic before worker planning.

## Required actions

1. Set working root to the directory that contains `SKILL.md`.
2. Create run folders under `artifacts/deep-research-agent/<run-id>/`:
   - `manager/`
   - `workers/`
   - `reducer/`
   - `gates/`
   - `deliverables/`
3. Write `manager/brief.md` with required fields:
   - `run_id`
   - `objective`
   - `decision_owner`
   - `decision_deadline_utc`
   - `non_goals`
   - `recency_window_days`
4. Write `manager/questions.md` with contiguous question IDs (`Q01`, `Q02`, ...), one testable question per line.
5. Write `manager/decision-rules.md` with deterministic tie-break order, including at least:
   - `RULE-SOURCE-COUNT`
   - `RULE-RECENCY`
   - `RULE-PRIMARY-OWNER`
6. Validate preflight invariants:
   - every question maps to exactly one decision area
   - no duplicated question text
   - no empty required fields in `manager/brief.md`
7. Write `manager/preflight-status.md` with `PASS` or `FAIL` and one-line evidence.
8. **STOP** and ask the user for confirmation: "Approve the brief, question set, and decision rules for worker execution?"
9. Record explicit approval in `manager/approval.md` before starting Step 1.

## Done when

- Run directories exist for the current `run_id`.
- Brief, questions, and decision rules are complete and non-empty.
- Preflight status is `PASS`.
- User approval is recorded in `manager/approval.md`.
