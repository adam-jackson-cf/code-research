# Role Lockfile Template

Use this schema to create `manager/role-lockfile.json`.

```json
{
  "run_id": "<run-id>",
  "created_utc": "<YYYY-MM-DDTHH:MM:SSZ>",
  "manager": {
    "name": "<manager-name>",
    "objective": "<one-sentence-objective>"
  },
  "workers": [
    {
      "worker_id": "W01",
      "role": "<role-name>",
      "question_ids": ["Q01"],
      "allowed_domains": ["<domain-1>", "<domain-2>"],
      "blocked_domains": ["<domain-3>"],
      "output_files": [
        "workers/W01/journal.jsonl",
        "workers/W01/sources.ndjson"
      ],
      "budget_tokens": 12000,
      "escalation_threshold": 0.8
    }
  ]
}
```

Required invariants:

- Worker IDs are contiguous (`W01` ... `WNN`).
- Each question ID appears exactly once in `workers[*].question_ids`.
- `allowed_domains` and `blocked_domains` never overlap.
- `budget_tokens` is an integer > 0 and `escalation_threshold` is in range (0,1].
