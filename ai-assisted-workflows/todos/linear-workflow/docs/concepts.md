# Linear Integration & Workflow Guide

Comprehensive internal reference for working with Linear core concepts (Issues, Projects, Teams, Cycles), GitHub integration automations, and our MCP Linear tooling workflows.

---

## 1. Core Domain Concepts

### 1.1 Issues

Atomic units of work (tasks, bugs, spikes). Key properties:

- Identifier: `<TEAMKEY>-<number>` (e.g. ENG-123)
- Status workflow: Backlog → Triage → Todo → In Progress → In Review → Ready to Merge → Done (customizable per team)
- Relationships: parent/sub-issues, blocking/blocked, related, duplicate
- Attachments: PRs, commits, documents, external links
- Sync: Can be synced bi-directionally with GitHub Issues (title, description, status, assignee, labels, sub-issues, comments in synced thread)

Best practices:

- One clear acceptance criteria section
- Prefer splitting into sub-issues rather than large monolithic cards
- Use labels for cross-cutting classification (tech debt, performance, security)
- Link dependencies early to surface critical path

### 1.2 Projects

Group related issues toward a defined outcome or launch.

- Each issue belongs to at most one project
- Have: name, goal/outcome, lead, members, description/spec, milestones, status (Planned, In Progress, Paused, Completed, Canceled), timeframes (start + target)
- Multi-team capable: aggregated board/timeline with per-team tabs
- Progress graph: derived from issue status distribution & estimates
- Custom views: attach filtered issues (e.g. My Issues, Bugs, Standup, Critical Path)

Usage pattern:

1. Draft project brief/spec (lead) → refine with team
2. Break into issues & sub-issues; tag unknowns as spikes
3. Define milestones (internal phase boundaries)
4. Monitor velocity & burndown; prune scope continuously

### 1.3 Teams

Logical grouping with independent workflows & status automations.

- Owns: issue workflow configuration, SLAs, GitHub automation rules
- Mapped to one or more GitHub repositories for PR automation & (optionally) issues sync

### 1.4 Cycles / Iterations (if enabled)

Time-boxed execution windows used for planning & velocity measurement.

- Each cycle cuts scope at start; new work beyond threshold gets deferred unless critical
- Use for short-term planning; Projects remain long-lived umbrellas

### 1.5 Initiatives (Optional Higher Layer)

Strategic grouping of multiple projects across domains; used for roadmapping & portfolio view.

---

## 2. GitHub Integration Overview

Two major capabilities:

1. Pull Request & Commit Linking + Status Automation
2. GitHub Issues Sync (one-way or bi-directional per repo/team pair)

### 2.1 PR & Commit Linking Methods

Linking triggers when any of the following include an issue ID (and optionally magic words):

- Branch name (copied via Linear shortcut Cmd/Ctrl+Shift+.)
- PR title
- PR description (supports magic words + multiple IDs)
- Commit message (magic words supported)

Magic word patterns:

- Closing (e.g. `Fixes ENG-123`, `Closes ENG-123`) → moves issue to In Progress on branch/commit push, Done on merge
- Non-closing (e.g. `Ref ENG-123`) → links without auto-close
- Ignore (`skip ENG-123` or `ignore ENG-123`) → prevents linking/automation even if branch name contains the ID

Multiple issues: `Fixes ENG-123, DES-5 and ENG-256`

Multiple PRs per issue: final required PR merge triggers terminal status transition

### 2.2 Status Automation Events (Configurable per Team)

- PR drafted/opened → move to In Progress
- Review requested / activity → move to In Review
- Checks passed / mergeable → Ready to Merge (requires branch protection or review requirements)
- PR merged (target branch rules) → Done / Deployed / QA, etc.
- Branch-specific regex rules: map target branches (e.g. `staging`, `main`, `^fea/.*`) to statuses

### 2.3 Commit Linking

Enable via webhook (magic word + ID in commit message). Mirrors PR automation flows.

### 2.4 Issue Sync (GitHub Issues ↔ Linear Issues)

Modes:

- One-way GitHub → Linear: new GitHub issues create Linear copies
- Two-way: issues created on either side synced to the other

Synced fields:

Title, Description, Status (GitHub project-specific custom statuses NOT synced), Assignee (requires connected accounts), Labels, Sub-issues hierarchy, Comments (only those inside the synced thread in Linear), Link references.

Limitations:

- Only one repository can be two-way synced per team at a time
- Historical issues require one-time import
- Moving synced issue between teams preserves sync
- Transferring GitHub issue between synced repos updates team

### 2.5 Linkbacks & Autolinks

- Linkbacks: optional GitHub comment referencing Linear issue (can suppress for private teams)
- GitHub Autolink references: configure pattern → `https://linear.app/<workspace>/issue/ID-<num>` per team

### 2.6 Preview Links

PR descriptions/comments scanned for preview URLs (Vercel/Netlify/etc.) and surfaced on the Linear issue.

### 2.7 Common Failure Modes

- Missing personal account connection → generic GitHub actor in Linear
- Lacking branch protection → Ready for Merge automation won’t trigger
- Squash merge after aggregating multiple PRs into a branch loses per-PR issue linkage; relink in the new PR description
- Reappearing unlink: branch still contains ID; use `skip` or `ignore` magic word

---

## 3. Operational Workflow (End-to-End)

### 3.1 Planning Phase

1. Create/Update Project (spec, outcomes, timeframe, lead)
2. Break down into issues; assign to teams; set labels & estimates
3. Define milestones & attach custom views (Critical Path, Open Risks, By Milestone)
4. Optionally align multiple projects under an Initiative

### 3.2 Execution Flow (Developer POV)

1. Pick issue from Todo/Ready
2. Use Linear shortcut to copy branch name (auto: `<teamkey>/<slug>-<id>`)
3. Create Git branch; push initial commit (links & moves to In Progress)
4. Open PR referencing issue ID (optionally with closing magic word)
5. PR review cycle (status moves via automation)
6. Merge PR (automation sets Done/Deployed based on branch rules)
7. If multiple PRs: repeat until final merges; issue closes only after last required PR

### 3.3 QA / Release

- Branch-specific automations route status (e.g. `staging` → In QA, `main` → Deployed)
- Additional manual verification labels or checklist sub-issues

### 3.4 Maintenance / Backlog Hygiene

- Periodically audit stale In Progress issues (no commits/PR updates)
- Convert ambiguous issues into clearer specs or close
- Aggregate recurring bugs into maintenance projects or labeled clusters

---

## 4. MCP Linear Tooling Integration

We expose Linear automation inside our AI-assisted workflow via an MCP (Model Context Protocol) server with tool surface mirroring common tasks. (Tools listed below are conceptual—verify actual implemented names in `mcp_linear` when integrating.)

### 4.1 Core Tool Categories

- Issue Operations: create_issue, update_issue, list_issues, search_issues, comment_on_issue
- Project Operations: create_project, update_project, list_projects, attach_issue_to_project
- Metadata: list_teams, list_cycles, list_labels, get_issue, get_project
- Documentation Support: search_documentation (already available) to surface official guidance inline

### 4.2 Intended Flow Using MCP

1. Ideation: AI agent calls `search_documentation` to fetch canonical patterns (e.g. project templates, milestones)
2. Creation: call `create_project` with spec outline (title, description, target date)
3. Decomposition: generate issue list; batch call `create_issue`; optionally link dependencies
4. PR Automation Assist: when local Git branch created, agent injects proper naming & magic words guidance
5. Status Drift Monitoring: scheduled agent queries `list_issues` filtering for stale statuses (e.g. In Progress > 5 days no PR events) → post summary comment or escalate
6. Release Coordination: agent inspects merged PRs against open issues nearing target date; prompts for closure or follow-up tasks
7. Post-Merge Cleanup: agent suggests archiving completed projects or rolling over unresolved sub-issues

### 4.3 Example AI Orchestrated Sequence

- Command: /plan-refactor
  - Gather existing issues via `list_issues` label=refactor
  - Cluster & propose new project
  - Use `create_project`
  - Generate spec & milestones (documentation search for best practices)
  - Spawn child issues; attach to project
  - Return summary + next branch naming conventions

### 4.4 Error Handling Patterns

- 404 Not Found → re-validate ID; re-query `list_*`
- Permission errors → prompt user to grant integration scope (GitHub org or Linear workspace)
- Rate limiting → exponential backoff, aggregate operations

### 4.5 Data Hygiene Policies

- Enforce one project per issue (if conflict, agent proposes split into sub-issues)
- Standard label taxonomy: `type:{bug|feat|chore|infra|sec|perf}`, `risk:{high|med|low}`, `priority:{p0..p3}`
- Auto-inject acceptance criteria placeholder if missing

---

## 5. GitHub Actions Integration Patterns

While Linear’s native integration handles linking, we supplement with GitHub Actions for enhanced traceability:

### 5.1 Suggested Workflow Jobs

- validate-branch-name: Ensures branch contains valid `<TEAMKEY>-<number>`; posts comment if mismatch
- sync-linear-status (optional): On PR open/update → query Linear via MCP to confirm link; if absent, suggest description magic word
- deployment-status: After deploy workflow success → update Linear issue with deployment note/comment

### 5.2 Example Automation Additions

- On PR merge to main: Action calls MCP to append release note stub to linked issues
- Nightly audit: Action enumerates open Done issues older than N days without release label → propose closure or regression verification

---

## 6. Governance & Roles

| Role                  | Responsibilities                                         |
| --------------------- | -------------------------------------------------------- |
| Project Lead          | Spec authoring, milestone health, scope decisions        |
| Engineering           | Issue implementation, PR hygiene, status fidelity        |
| QA/Reviewer           | Review gating, branch rule feedback, risk surfacing      |
| AI Orchestrator Agent | Decomposition assistance, stale detection, doc surfacing |
| Release Manager       | Target date alignment, cross-project dependency tracking |

---

## 7. Quick Reference Cheat Sheet

| Action                | Method                                                         |
| --------------------- | -------------------------------------------------------------- |
| Link issue to PR      | Include ID in branch OR PR title/description                   |
| Prevent automation    | `skip ENG-123` in PR description                               |
| Link multiple issues  | `Fixes ENG-1, ENG-2 and ENG-3`                                 |
| Close via commit      | `Fixes ENG-123` in commit message                              |
| Ignore branch linkage | Add `ignore ENG-123` to PR description                         |
| Sync GitHub Issues    | Configure repo ↔ team (one or bi-directional)                 |
| Add previews          | Ensure provider comment or markdown link ending with "preview" |
| Branch automations    | Configure per-team: target branch → status                     |

---

## 8. Expansion Opportunities

- Add AI-generated project health dashboard (cycle time, WIP aging) sourced via MCP queries
- Integrate semantic diff analyzer to auto-suggest risk labels on issues based on touched modules
- Implement release notes aggregator using merged PR → linked issues → project milestone mapping

---

## 9. Planning Workflow Documentation

For detailed step-by-step guidance on using the `/plan-linear` command, including:

- Complete workflow walkthrough with examples
- Diff mode usage and patterns
- Error handling and recovery strategies
- Integration examples with CI/CD

See: [Linear Planning Workflow Guide](workflow.md)

## 10. Appendix: Recommended Branch Format

`<teamkey>/<short-feature-slug>-<TEAMKEY>-<number>`

Example: `eng/cache-layer-refactor-ENG-482`

Automations rely only on the `ENG-482` token but consistent prefixing improves searchability.

---

Last updated: 2025-09-30
