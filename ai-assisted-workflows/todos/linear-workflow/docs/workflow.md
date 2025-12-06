# Linear Planning Workflow Guide

Complete walkthrough of the `/plan-linear` command workflow, from initial planning artifact to Linear project creation, with detailed examples and diff mode usage.

---

## 1. Overview

The `/plan-linear` command transforms unstructured planning artifacts (PRDs, feature requests, technical specs) into actionable Linear project plans through a deterministic, multi-agent workflow.

**Key Characteristics:**

- **Stateless subagents**: Each step handled by specialized agents with single responsibilities
- **Deterministic hashing**: Ensures reproducible results and change detection
- **Quality gates**: Multiple validation layers before Linear mutation
- **Incremental support**: Diff mode for iterative planning

---

## 2. Complete Workflow Step-by-Step

### Step 1: Argument & Config Validation

```
Input: /plan-linear "Add user authentication with MFA" --project "Auth Q4 2025" --dry-run
```

**What happens:**

- Validates all flags (`--project`, `--estimate-style`, etc.)
- Resolves configuration from:
  1. `--config` flag (if provided)
  2. `.claude/linear-plan.config.json` (project-level)
  3. `$HOME/.claude/linear-plan.config.json` (user-level)
- Computes `config_fingerprint` for change detection
- **Failure**: Exit code 1 with JSON error envelope

### Step 2: Artifact Acquisition

**Input Sources:**

- Direct string: `"Add user authentication with MFA"`
- Piped content: `echo "User authentication feature..." | /plan-linear --dry-run`
- File reference: `/plan-linear prd.md --dry-run`

**Validation:** Empty artifact → `EMPTY_ARTIFACT` error

### Step 3: Objective Definition

**Agent:** `@linear-objective-definition`

**Input:** Raw artifact text
**Output:**

```json
{
  "task_objective": "Deliver MFA authentication for privileged accounts",
  "purpose": "Strengthen account security in the core admin console without disrupting existing login flows.",
  "affected_users": ["admin-operators", "support-analysts"],
  "requirements": [
    "Require MFA for admin users on login",
    "Provide backup codes for recovery",
    "Support SMS and authenticator app factors"
  ],
  "constraints": [
    "No new database tables",
    "Mobile clients must remain functional"
  ],
  "assumptions": ["Cognito tenant available"],
  "open_questions": [
    "Do support analysts require MFA on first login?",
    "Is there an established SMS provider?"
  ]
}
```

**Command Action:** Persists the structured objective to `linear-objective-definition-output.json`, initializes `cycle_plan_report.json.objective`, and prepares a clarification checklist.

### Step 4: Clarification Loop

**Interaction:** Present the extracted objective summary, requirements, and open questions to the user.
**Goal:** Capture clarifications before any decomposition.

**Expected Flow:**

1. Render summary (task objective, purpose, affected users).
2. List requirements and constraints.
3. Ask the user to answer each `open_questions` item or confirm no updates.
4. Record clarifications in `cycle_plan_report.json.objective.clarifications[]`:

```json
{
  "clarifications": [
    {
      "question": "Do support analysts require MFA on first login?",
      "answer": "Yes, MFA mandatory after first login."
    }
  ]
}
```

Proceed only after the user explicitly types `proceed`.

### Step 5: Issue Decomposition

**Agent:** `@linear-issue-decomposer`

**Input:** Confirmed requirements + user clarifications
**Output:**

```json
{
  "issues": [
    {
      "id": "ISS-001",
      "provisional_title": "Implement MFA login flow",
      "category": "feature",
      "deps": [],
      "parent": null
    },
    {
      "id": "ISS-002",
      "provisional_title": "Add backup code management",
      "category": "feature",
      "deps": ["ISS-001"],
      "parent": null
    }
  ]
}
```

### Step 6: Estimation

**Agent:** `@linear-estimation-engine`

**Input:** Issues + complexity weights from config
**Output:**

```json
{
  "issues": [
    {
      "id": "ISS-001",
      "size": "M",
      "rcs": 5,
      "oversize_flag": false
    },
    {
      "id": "ISS-002",
      "size": "L",
      "rcs": 8,
      "oversize_flag": true
    }
  ]
}
```

### Step 7: Acceptance Criteria

**Agent:** `@linear-acceptance-criteria-writer`

**Input:** Estimated issues + confirmed objective/clarifications
**Output:**

```json
{
  "issues": [
    {
      "id": "ISS-001",
      "acceptance_criteria": [
        "User can enable MFA via SMS",
        "Backup codes generated",
        "MFA required for admin roles"
      ]
    }
  ]
}
```

### Step 8: Hashing & Integrity Check

**Agent:** `@linear-hashing` (compute mode)

**Input:** Complete plan state
**Output:**

```json
{
  "hashes": {
    "artifact_raw": "sha256:abc123...",
    "artifact_normalized": "sha256:def456...",
    "plan": "sha256:ghi789...",
    "config_fingerprint": "sha256:jkl012..."
  },
  "issues": [
    { "id": "ISS-001", "hash": "sha256:mno345..." },
    { "id": "ISS-002", "hash": "sha256:pqr678..." }
  ],
  "duplicates": {
    "issue_id_conflicts": [],
    "structural_duplicates": []
  },
  "errors": [],
  "warnings": []
}
```

**Critical:** Any `errors` array non-empty → immediate abort (exit 4)

### Step 9: Readiness Validation

**Agent:** `@linear-readiness`

**Input:** Complete plan + hashes
**Output:**

```json
{
  "findings": [
    {
      "severity": "warning",
      "code": "SPLIT_SUGGESTED",
      "issue_id": "ISS-002",
      "message": "Consider splitting large issue ISS-002"
    }
  ],
  "label_assignments": [
    { "issue_id": "ISS-001", "labels": ["type:feature", "security:mfa"] },
    { "issue_id": "ISS-002", "labels": ["type:feature", "integration:social"] }
  ],
  "dependency_suggestions": [
    {
      "from": "ISS-002",
      "to": "ISS-001",
      "reason": "Shared auth infrastructure"
    }
  ],
  "readiness": {
    "ready": true,
    "pending_steps": [],
    "advisories": ["Consider splitting oversize issues"],
    "requires_split": true,
    "plan_hash": "sha256:ghi789...",
    "timestamp": "2025-09-30T15:30:00Z"
  }
}
```

**Command Decision:**

- `ready: false` → abort (exit 2) with readiness details
- `ready: true` → proceed to final report

### Step 10: Final Report Assembly

**Command Action:** Combine all outputs into canonical `PlanLinearReport`:

```json
{
  "PlanLinearReport": {
    "version": 3,
    "objective": {
      /* from Step 3 (plus Step 4 clarifications) */
    },
    "issues": {
      "totals": {
        /* from Step 5 */
      },
      "complexity": {
        /* from Step 6 */
      },
      "items": [
        /* combined output from Steps 5-7 */
      ],
      "dependencies": {
        /* from Step 5 */
      }
    },
    "hashes": {
      /* from Step 8 */
    },
    "readiness": {
      /* from Step 9 */
    },
    "mutation": {
      /* present only if Step 11 executed */
    },
    "diff": {
      /* if --diff used */
    }
  }
}
```

### Step 11: Optional Mutation (if not `--dry-run`)

**Agents:** `@linear-issue-writer` → `@linear-dependency-linker`

**Sequence:**

1. Create/find Linear project
2. Batch create issues with provisional titles
3. Apply labels from readiness output
4. Link dependencies as suggested
5. Return mutation results

**Output added to report:**

```json
"mutation": {
  "project_id": "LINPROJ-456",
  "created_issue_ids": ["ENG-789", "ENG-790"],
  "skipped_issue_ids": [],
  "linked_edges": [
    {"from": "ENG-790", "to": "ENG-789"}
  ],
  "cycle_warnings": []
}
```

---

### 3.3 Detailed Example

**Initial Planning Session:**

```bash
/plan-linear "Add user authentication" --dry-run > auth-plan-v1.json
```

**Output (excerpt):**

```json
{
  "issues": {
    "totals": { "total": 3, "feature": 3 },
    "items": [
      {
        "id": "ISS-001",
        "title": "Set up basic auth",
        "size": "M",
        "acceptance_criteria": ["User can log in"]
      },
      {
        "id": "ISS-002",
        "title": "Add password reset",
        "size": "S",
        "acceptance_criteria": ["Users receive reset email"]
      },
      {
        "id": "ISS-003",
        "title": "Create user profile",
        "size": "M",
        "acceptance_criteria": ["User can edit profile"]
      }
    ]
  }
}
```

**Requirements Evolve - Add MFA:**

```bash
/plan-linear "Add user authentication with MFA support" --diff auth-plan-v1.json --dry-run
```

**Diff Output:**

```json
{
  "diff": {
    "added": ["ISS-004"],
    "removed": [],
    "changed": [
      {
        "id": "ISS-001",
        "fields": ["title", "size", "acceptance_criteria"],
        "changes": {
          "title": {
            "from": "Set up basic auth",
            "to": "Set up auth with MFA"
          },
          "size": { "from": "M", "to": "L" },
          "acceptance_criteria": {
            "from": ["Basic login/logout"],
            "to": ["Basic login/logout", "MFA setup", "Backup codes"]
          }
        }
      }
    ],
    "plan_hash_before": "sha256:abc123...",
    "plan_hash_after": "sha256:def456...",
    "reordered_only": []
  }
}
```

**Interpretation:**

- **New issue**: ISS-004 (likely "Configure MFA providers")
- **Modified**: ISS-001 expanded from basic auth to MFA-enabled auth
- **Impact**: Total effort increased (M→L), new acceptance criteria added
- **Decision**: Team can review if scope increase is acceptable

### 3.4 Advanced Diff Patterns

**Scenario 1: Issue Splitting**

```json
{
  "removed": ["ISS-002"],
  "added": ["ISS-005", "ISS-006"],
  "changed": [
    {
      "id": "ISS-001",
      "fields": ["deps"],
      "changes": { "deps": { "from": [], "to": ["ISS-005"] } }
    }
  ]
}
```

_Interpretation: Large issue ISS-002 split into two smaller issues ISS-005/ISS-006_

**Scenario 2: Dependency Reorganization**

```json
{
  "added": [],
  "removed": [],
  "changed": [
    {
      "id": "ISS-003",
      "fields": ["deps"],
      "changes": { "deps": { "from": ["ISS-001"], "to": ["ISS-004"] } }
    }
  ]
}
```

_Interpretation: Critical path changed - ISS-003 now depends on new MFA issue instead of basic auth_

**Scenario 3: No Structural Changes**

```json
{
  "added": [],
  "removed": [],
  "changed": [],
  "plan_hash_before": "sha256:abc123...",
  "plan_hash_after": "sha256:abc123..."
}
```

_Interpretation: Only cosmetic changes (typos, formatting) - safe to skip Linear mutation_

### 3.5 Integration with CI/CD

**Pre-commit Hook Example:**

```bash
#!/bin/bash
# Check if auth plan changed significantly
if [ -f "auth-plan-baseline.json" ]; then
  /plan-linear "Update auth requirements" --diff auth-plan-baseline.json --dry-run > auth-plan-current.json

  # Extract diff summary
  CHANGES=$(jq -r '.diff | (.added | length) + (.removed | length) + (.changed | length)' auth-plan-current.json)

  if [ "$CHANGES" -gt 5 ]; then
    echo "⚠️  Large number of changes detected ($CHANGES). Consider breaking into smaller iterations."
    exit 1
  fi
fi
```

**PR Comment Automation:**

```yaml
# .github/workflows/plan-diff.yml
- name: Generate planning diff
  run: |
    /plan-linear "${{ github.event.pull_request.title }}" \
      --diff baseline-plan.json \
      --report-format json > plan-diff.json

    # Create PR comment with diff summary
    DIFF_SUMMARY=$(jq -r '
      "## Planning Changes Summary\n" +
      "- Added: \(.diff.added | length) issues\n" +
      "- Removed: \(.diff.removed | length) issues\n" +
      "- Modified: \(.diff.changed | length) issues\n" +
      "### Modified Issues:\n" +
      (.diff.changed[] | "- \(.id): \(.fields | join(", "))\n")
    ' plan-diff.json)

    gh pr comment "$PR_URL" --body "$DIFF_SUMMARY"
```

---

## 4. Error Handling & Recovery

### 4.1 Common Failure Modes

**Config Issues (Exit 1):**

```json
{
  "exit_code": 1,
  "error": {
    "code": "CONFIG_MISSING_KEYS",
    "message": "Required configuration keys are missing",
    "details": {
      "missing": ["label_rules", "thresholds"],
      "path": "/home/user/.claude/linear-plan.config.json"
    }
  }
}
```

**Hashing Failures (Exit 4):**

```json
{
  "exit_code": 4,
  "error": {
    "code": "HASHING_DUPLICATION",
    "message": "Structural duplicates detected",
    "details": {
      "duplicates": [{ "hash": "sha256:abc...", "ids": ["ISS-001", "ISS-003"] }]
    }
  }
}
```

**Readiness Failures (Exit 2):**

```json
{
  "exit_code": 2,
  "error": {
    "code": "READINESS_BLOCKING",
    "message": "Plan not ready for Linear mutation",
    "details": {
      "readiness": {
        "ready": false,
        "pending_steps": ["acceptance_criteria"],
        "blocking_findings": [
          {
            "code": "MISSING_SECTION",
            "issue_id": "ISS-002",
            "message": "Missing Acceptance Criteria"
          }
        ]
      }
    }
  }
}
```

### 4.2 Recovery Strategies

**Config Recovery:**

```bash
# Generate template config
/plan-linear --list-subagents  # Shows required config structure
# Copy template to user location
cp template-config.json ~/.claude/linear-plan.config.json
# Edit with actual values
```

**Hashing Recovery:**

```bash
# Identify duplicate issues
/plan-linear "my feature" --dry-run | jq '.hashes.duplicates'
# Manually resolve by editing artifact or using more specific language
```

**Readiness Recovery:**

```bash
# Check what's missing
/plan-linear "my feature" --dry-run | jq '.readiness.pending_steps'
# Address specific gaps in artifact or requirements
```

---

## 5. Best Practices

### 5.1 Planning Artifact Quality

**Good PRD Structure:**

```markdown
# Feature: User Authentication with MFA

## Requirements

- Users can register with email/password
- MFA required for admin accounts
- Social login support (Google, GitHub)

## Constraints

- No database schema changes
- Mobile app compatibility
- 2FA backup codes required

## Acceptance Criteria

- [ ] User registration flow works
- [ ] MFA setup completes successfully
- [ ] Social login redirects correctly
```

**Avoid:**

- Vague requirements ("improve security")
- Missing constraints (leads to oversized issues)
- Incomplete acceptance criteria

### 5.2 Iterative Planning Workflow

1. **Draft Initial Plan**: `/plan-linear "basic feature" --dry-run > plan-v1.json`
2. **Review & Refine**: Edit artifact based on output
3. **Compare Changes**: `/plan-linear "updated feature" --diff plan-v1.json --dry-run`
4. **Team Review**: Share diff with stakeholders
5. **Finalize & Commit**: Remove `--dry-run` when ready

### 5.3 Team Collaboration

**Baseline Management:**

```bash
# Store baseline in repo for team visibility
git add plan-baseline.json
git commit -m "Add planning baseline for auth feature"

# Team members can diff against latest
/plan-linear "updated requirements" --diff plan-baseline.json --dry-run
```

**Review Process:**

- Use diff mode in PR descriptions
- Include readiness warnings in review comments
- Document decisions that lead to plan changes

---

## 6. Integration Examples

### 6.1 GitHub Actions Integration

**Workflow File:** `.github/workflows/plan-validation.yml`

```yaml
name: Validate Linear Plan

on:
  pull_request:
    paths: ["docs/prds/**/*.md"]

jobs:
  validate-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup AI Assistant
        run: |
          # Install your preferred AI assistant CLI

      - name: Validate PRD Changes
        run: |
          for prd in $(git diff --name-only origin/main | grep '\.md$'); do
            echo "Validating $prd..."
            /plan-linear "$prd" --dry-run --report-format json > "validation-$(basename $prd .json).json"

            # Check for blocking issues
            READY=$(jq -r '.readiness.ready' "validation-$(basename $prd .json).json")
            if [ "$READY" = "false" ]; then
              echo "❌ Plan not ready for $prd"
              jq -r '.readiness.pending_steps[]' "validation-$(basename $prd .json).json"
              exit 1
            fi
          done

      - name: Comment PR with Results
        if: always()
        run: |
          # Aggregate validation results and comment on PR
          # (implementation depends on your PRD structure)
```

### 6.2 Local Development Setup

**Shell Alias:**

```bash
# Add to ~/.bashrc or ~/.zshrc
alias plan='() {
  if [ -f "plan-baseline.json" ]; then
    /plan-linear "$*" --diff plan-baseline.json
  else
    /plan-linear "$*"
  fi
}'
```

**Usage:**

```bash
plan "Add user search functionality" --dry-run
plan "Add user search with filters" --dry-run  # Automatically diffs against baseline
```

### 6.3 IDE Integration

**VS Code Task:** `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate Linear Plan",
      "type": "shell",
      "command": "/plan-linear",
      "args": [
        "${input:planDescription}",
        "--dry-run",
        "--report-format",
        "json"
      ],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ],
  "inputs": [
    {
      "id": "planDescription",
      "description": "Plan description",
      "default": "${fileText}",
      "type": "promptString"
    }
  ]
}
```

---

## 7. Troubleshooting Guide

### 7.1 Common Issues

**Problem:** Plan hash changes unexpectedly
**Solution:** Check for:

- Whitespace differences in artifact
- Array ordering changes (deps, labels)
- Timestamp inclusion in inputs

**Problem:** Diff shows many changes for minor edits
**Solution:**

- Use `--diff` to identify specific changed fields
- Consider if changes warrant new Linear issues or modifications

**Problem:** Readiness fails on missing sections
**Solution:**

- Review artifact for incomplete requirements
- Check if acceptance criteria are specific and testable
- Verify constraints are clearly stated

### 7.2 Debug Commands

```bash
# Check config resolution
/plan-linear --debug "test" --dry-run 2>&1 | grep config

# Validate subagent availability
/plan-linear --list-subagents

# Inspect hashing details
/plan-linear "test" --dry-run | jq '.hashes'

# Check readiness details
/plan-linear "test" --dry-run | jq '.readiness'
```

---

## 8. Performance Considerations

### 8.1 Large Plans

**Optimization Tips:**

- Use `--max-size` to prevent oversized issues
- Consider splitting large features into multiple planning runs
- Use diff mode to avoid reprocessing unchanged sections

### 8.2 Caching Strategy

**Effective Baseline Usage:**

```bash
# Cache baseline for frequent iterations
PLAN_CACHE_DIR=".plan-cache"
mkdir -p "$PLAN_CACHE_DIR"

# Function to get latest baseline
get_baseline() {
  local feature="$1"
  echo "$PLAN_CACHE_DIR/${feature}-baseline.json"
}

# Usage with automatic baseline detection
baseline_file=$(get_baseline "auth")
if [ -f "$baseline_file" ]; then
  /plan-linear "$*" --diff "$baseline_file"
else
  /plan-linear "$*"
fi
```

---

Last updated: 2025-09-30
