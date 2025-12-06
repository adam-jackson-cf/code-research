---
description: "Plan Linear workflow with objective-first clarification and sequential subagents"
argument-hint: <artifact-or-path> [--linear-project-id <id>] [--config <path>] [--estimate-style {tshirt|none}] [--max-size <SIZE>] [--dry-run] [--auto] [--diff <file>] [--report-format {json|markdown|both}]
allowed-tools:
  ["Task", "Read", "Write", "Edit", "TodoWrite", "Bash", "Grep", "Glob", "LS"]
---

# Purpose

Transform a raw planning artifact into a Linear-ready plan by driving the objective definition, clarification loop, gated planning phases, and optional mutation.

## Environment checks

Carry out preflight checks and immediately exit workflow if any invalid:

- resolve `linear-plan.config.json` config in precedence (`--config` → `./.claude/` → `~/.claude/`); compute `config_fingerprint`.

## Variables

- `TASK_INPUT` ← first positional argument or piped stdin

**Optional:**

- `PROJECT_ID` ← `--linear-project-id`
- `ESTIMATE_STYLE` ← `--estimate-style` (default `tshirt`)
- `MAX_SIZE` ← `--max-size <XS|S|M|L>` (default from config)
- `DRY_RUN` ← `--dry-run`
- `AUTO_MODE` ← `--auto`
- `DIFF_BASE` ← `--diff`

## Instructions

- NEVER continue without a valid artifact; emit `EMPTY_ARTIFACT` error envelope on failure.
- IMPORTANT: Maintain deterministic ordering for config fingerprint, requirements, and issue IDs.
- ALWAYS create `.workspace/<cycle_slug>` and persist every subagent artifact inside it.
- ALWAYS surface `open_questions` and wait for explicit `proceed` (unless `--auto`).
- Invoke subagents sequentially: objective → decomposition → estimation (conditional) → acceptance criteria → hashing → readiness.
- Do NOT guess requirements, DoD, or constraints; rely solely on clarified inputs.
- STOP before readiness approval and before mutation unless `--auto` requested.
- Never mutate Linear unless readiness `ready=true` and user confirms.
- Respect hash integrity—never recalculate locally; trust `@agent-linear-hashing`.

## Workflow

1. Parse arguments; validate flag set; compute `config_fingerprint`.
2. Acquire artifact (`TASK_INPUT` or stdin/file); on empty, emit `EMPTY_ARTIFACT` error and stop.
3. Initialize workspace: ensure `.workspace` exists, derive `cycle_slug = kebab_case(task_objective)` after objective extraction, create `CYCLE_DIR`.
4. Invoke `@agent-linear-objective-definition`; store `linear-objective-definition-output.json`; seed `cycle_plan_report.json.objective`.
5. Clarification loop:
   - Present objective summary, affected users, requirements, constraints.
   - List `open_questions`; collect answers until each resolved or user types `proceed`.
   - Append `{question, answer}` to `objective.clarifications`; update summary and reconfirm.
   - **⚠️ PAUSE FOR REQUIRED USER CONFIRMATION**: Prompt the user to resolve outstanding questions or explicitly reply `proceed` before continuing (unless `AUTO_MODE`).
6. Planning loop (sequential, never parallel):
   - `@agent-linear-issue-decomposer` → write input/summary/output artifacts.
   - If `ESTIMATE_STYLE=tshirt`, call `@agent-linear-estimation-engine`.
   - `@agent-linear-acceptance-criteria-writer` → record acceptance criteria only.
   - `@agent-linear-hashing` → capture hashes, duplication report; abort on hashing errors with exit code 4.
7. Update `cycle_plan_report.json` after each subagent with current state, totals, and clarifications.
8. Run `@agent-linear-readiness`; embed findings/labels/dependency suggestions. If `ready=false`, emit readiness envelope with exit code 2.
9. **⚠️ PAUSE FOR REQUIRED USER CONFIRMATION**: Ask "Plan formed and readiness check successful, proceed with transfer to linear? (y/n)" unless `AUTO_MODE`; exit if declined.
10. When proceeding and not `DRY_RUN`:
    - For existing projects, invoke `@agent-linear-issue-search` per issue before creation.
    - `@agent-linear-issue-writer` → batch create/update; ensure issue body uses Task Objective / Requirements / Acceptance Criteria sections only.
    - `@agent-linear-dependency-linker` → apply edges.
    - Verify hashes unchanged; append mutation results to report.
11. Emit final `cycle_plan_report.json` report, including diff info when `DIFF_BASE` provided; persist JSON to `CYCLE_DIR/cycle_plan_report.json`.

## Output

### Cycle Plan Report (Canonical Schema)

```json
{
  "CycleName": {
    "version": 3,
    "objective": {
      "task_objective": "Deliver authentication hardening for user-facing API",
      "purpose": "Reduce takeover risk for privileged accounts while keeping login latency flat.",
      "affected_users": ["admin-operators", "support-analysts"],
      "requirements": [
        "Require MFA for admin roles",
        "Provide backup codes during enrollment",
        "Log MFA events for audit export"
      ],
      "constraints": ["no-db-schema-changes", "release-window:2025-Q4"],
      "assumptions": ["backwards-compatible client SDKs"],
      "open_questions": [],
      "clarifications": [
        {
          "question": "Do support analysts require MFA on first login?",
          "answer": "Yes, enforce MFA immediately after first login."
        }
      ]
    },
    "issues": {
      "totals": {
        "total": 12,
        "feature": 8,
        "foundation": 2,
        "risk": 2
      },
      "complexity": {
        "sizes": {
          "XS": 1,
          "S": 4,
          "M": 5,
          "L": 2,
          "XL": 0
        },
        "rcs_min": 1,
        "rcs_max": 8,
        "oversize": ["ISS-010"]
      },
      "items": [
        {
          "id": "ISS-001",
          "title": "Require MFA for admin login",
          "category": "feature",
          "deps": ["ISS-004"],
          "size": "M",
          "rcs": 5,
          "oversize_flag": false,
          "requirements": [
            "Prompt admin users for second factor on login",
            "Provide recovery backup codes"
          ],
          "acceptance_criteria": [
            "Admin login enforces second factor before granting session",
            "Backup codes can be generated once per user and invalidate older codes"
          ]
        }
      ],
      "dependencies": {
        "edges": 5,
        "roots": ["ISS-001"],
        "leaves": ["ISS-020"]
      }
    },
    "hashes": {
      "artifact_raw": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "artifact_normalized": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "plan": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "config_fingerprint": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    },
    "readiness": {
      "findings": [],
      "label_assignments": [
        {
          "issue_id": "ISS-001",
          "labels": ["type:feature", "planning:ai-linear"]
        }
      ],
      "dependency_suggestions": [],
      "ready": true,
      "requires_split": false,
      "pending_steps": [],
      "advisories": [],
      "plan_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "timestamp": "2025-09-30T12:34:56Z"
    },
    "mutation": {
      "project_id": "LINPROJ-123",
      "project_url": "https://linear.app/workspace/project/LINPROJ-123",
      "cycle_id": "CYCLE-456",
      "created_issue_ids": [
        {
          "id": "LIN-101",
          "title": "Issue title",
          "url": "https://linear.app/workspace/issue/LIN-101"
        },
        {
          "id": "LIN-102",
          "title": "Issue title",
          "url": "https://linear.app/workspace/issue/LIN-102"
        },
        {
          "id": "LIN-103",
          "title": "Issue title",
          "url": "https://linear.app/workspace/issue/LIN-103"
        }
      ],
      "skipped_issue_ids": [
        {
          "id": "ISS-999",
          "reason": "duplicate_found",
          "existing_issue_id": "LIN-050",
          "existing_issue_url": "https://linear.app/workspace/issue/LIN-050"
        }
      ],
      "linked_edges": [
        {
          "from": "LIN-101",
          "to": ["LIN-102", "LIN-103"]
        }
      ],
      "cycle_warnings": [],
      "duplicate_detection_summary": {
        "total_searched": 12,
        "duplicates_found": 1,
        "duplicates_skipped": 1
      }
    },
    "readiness": {
      "ready": true,
      "requires_split": false,
      "pending_steps": [],
      "advisories": [],
      "plan_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "timestamp": "2025-09-30T12:34:56Z"
    },
    "diff": { "added": [], "removed": [], "changed": [] } // present only when --diff used
  }
}
```

## Examples

```bash
/plan-linear-v2 "Add MFA to admin console" --linear-project-id "SEC-PLATFORM" --dry-run
/plan-linear-v2 ./docs/auth-prd.md --estimate-style none
```
