# Step 1 Workflow: Manager plan and role lockfile

## Objective

Assign worker responsibilities and freeze role ownership in an immutable lockfile.

## Required actions

1. Load `manager/brief.md`, `manager/questions.md`, and `manager/approval.md`.
2. Assign contiguous worker IDs (`W01`, `W02`, ... `WNN`) and explicit role names.
3. Populate `manager/role-lockfile.json` using [../assets/templates/role-lockfile-template.md](../assets/templates/role-lockfile-template.md).
4. For each worker entry, set:
   - `worker_id`
   - `role`
   - `question_ids`
   - `allowed_domains`
   - `blocked_domains`
   - `output_files`
   - `budget_tokens`
   - `escalation_threshold`
5. Validate lockfile invariants:
   - each question ID appears exactly once across all workers
   - every worker has at least one question ID
   - `allowed_domains` and `blocked_domains` do not overlap
   - `output_files` are unique across workers
6. Compile deterministic per-worker locks:

```bash
python3 scripts/agent_manager.py --manager-plan-path manager/role-lockfile.json --locks-dir manager/worker-locks --manifest-path manager/worker-locks-manifest.json
```

7. Validate each generated lock:

```bash
python3 scripts/role_lock_validate.py --role-lock-path manager/worker-locks/W01.role-lock.json
```

8. Generate checksum evidence:

```bash
shasum -a 256 manager/role-lockfile.json > manager/role-lockfile.sha256
```

9. Write `manager/plan-status.md` with `PASS` or `FAIL` and list any failed invariants.
10. Treat `manager/role-lockfile.json` as immutable for this run after `PASS`.

## Done when

- Lockfile exists and contains complete worker assignments.
- Worker lock files are generated under `manager/worker-locks/`.
- All lockfile invariants pass.
- Lockfile checksum exists at `manager/role-lockfile.sha256`.
- Plan status is `PASS`.
