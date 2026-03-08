---
name: deep-research-agent
description: Execute deterministic manager-worker deep research with locked roles, append-only journals, serial reduction, and evidence/prose gates. USE WHEN you need auditable multi-agent research that can be reproduced end to end.
---
<!-- generated: create-skill -->

# Deep Research Agent

Run a deterministic deep-research workflow that separates manager planning from worker evidence collection and enforces binary publication gates.

- You need multiple research workers with non-overlapping responsibilities.
- You need a lockfile that freezes worker roles before execution.
- You need append-only journals and reproducible merge order.
- You need citation validation and prose-quality gates before delivery.

## Workflow

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_ROOT="artifacts/deep-research-agent/${RUN_ID}"
mkdir -p "${ARTIFACT_ROOT}"/{manager,workers,reducer,gates,deliverables}
```

### Step 0: Preflight and brief lock

**Purpose**: Freeze objective, question set, and tie-break rules before worker execution.

- Create the run artifact root and required subdirectories.
- Write `manager/brief.md`, `manager/questions.md`, and `manager/decision-rules.md` with deterministic fields.
- Reject execution when any question is ambiguous, overlapping, or missing an owner decision context.
- **STOP** and ask the user for confirmation: "Approve the brief, question set, and decision rules for worker execution?"
- Continue only after explicit approval is recorded in `manager/approval.md`.

See [references/step-0-preflight-and-brief-lock-workflow.md](references/step-0-preflight-and-brief-lock-workflow.md).

### Step 1: Manager plan and role lockfile

**Purpose**: Assign worker responsibilities and freeze them in a role lockfile.

- Assign contiguous worker IDs (`W01`, `W02`, ...) with explicit question ownership and source boundaries.
- Write `manager/role-lockfile.json` from `assets/templates/role-lockfile-template.md`.
- Validate lockfile invariants (full question coverage, no duplicate question assignments, no empty worker entries).
- Compile deterministic worker locks with `python3 scripts/agent_manager.py --manager-plan-path manager/role-lockfile.json --locks-dir manager/worker-locks --manifest-path manager/worker-locks-manifest.json`.
- Validate each generated lock with `python3 scripts/role_lock_validate.py --role-lock-path manager/worker-locks/<worker_id>.role-lock.json`.
- Treat the lockfile and generated worker locks as immutable for this run.

See [references/step-1-manager-plan-and-role-lockfile-workflow.md](references/step-1-manager-plan-and-role-lockfile-workflow.md).

### Step 2: Worker execution with append-only journals

**Purpose**: Collect evidence through isolated workers while preserving immutable execution history.

- Create `workers/<worker_id>/journal.jsonl` and append events with `python3 scripts/worker_journal_append.py --journal-path workers/<worker_id>/journal.jsonl --event-path workers/<worker_id>/next-event.json`.
- Append every query, fetch, extraction, and correction event as a new JSONL event; never rewrite prior entries.
- Record source cards in `workers/<worker_id>/sources.ndjson`, one JSON object per line, in capture order.
- Mark each worker complete with a terminal `status_complete` event and unresolved-gap list.

See [references/step-2-worker-execution-and-journaling-workflow.md](references/step-2-worker-execution-and-journaling-workflow.md).

### Step 3: Serial reducer merge

**Purpose**: Merge worker outputs in lockfile order into a single synthesis without parallel reducer writes.

- Read worker IDs from `manager/role-lockfile.json` and process strictly in listed order.
- Append each merge operation to `reducer/merge-log.md` using `assets/templates/reducer-merge-template.md`.
- Build `reducer/canonical-evidence.json` with stable claim IDs (`C001`, `C002`, ...) and explicit source references.
- Resolve conflicts using the tie-break sequence in `manager/decision-rules.md`; flag unresolved conflicts instead of deleting them.

See [references/step-3-serial-reducer-merge-workflow.md](references/step-3-serial-reducer-merge-workflow.md).

### Step 4: Citation and validation gates

**Purpose**: Enforce evidence integrity before prose drafting.

- Execute the gate rubric in `references/validation-gate.md` and write `gates/citation-validation-report.md`.
- Fail the run when any claim lacks required source count, source independence, or traceability to worker journals.
- Route failures to targeted remediation tasks in `manager/remediation.md` and return to Step 2.
- Continue only when citation validation status is `PASS`.

See [references/step-4-citation-and-validation-gates-workflow.md](references/step-4-citation-and-validation-gates-workflow.md).

### Step 5: Prose quality gate

**Purpose**: Convert validated claims into publication-ready prose with deterministic quality checks.

- Draft `deliverables/report.md` from `reducer/canonical-evidence.json` without introducing new claims.
- Evaluate prose with `python3 scripts/prose_rubric_score.py --input-path deliverables/report.md --output-path gates/prose-quality-report.json --min-dimension 3 --min-overall 3.5`.
- Fail the run when prose checks fail and revise wording without mutating claim IDs.
- Continue only when prose quality status is `PASS`.

See [references/step-5-prose-quality-gate-workflow.md](references/step-5-prose-quality-gate-workflow.md).

### Step 6: Delivery and handoff

**Purpose**: Publish a complete, auditable package for the decision owner.

- Assemble `deliverables/handoff.md` with objective, findings, gate outcomes, open risks, and next decisions.
- Verify both `gates/citation-validation-report.md` and `gates/prose-quality-report.json` report `PASS`.
- Deliver the package only when all required artifacts exist and hashes match the locked plan.

See [references/step-6-delivery-and-handoff-workflow.md](references/step-6-delivery-and-handoff-workflow.md).
