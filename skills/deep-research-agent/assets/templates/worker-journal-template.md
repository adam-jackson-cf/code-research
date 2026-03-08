# Worker Journal Template

Use this structure for append-only `workers/<worker_id>/journal.jsonl`.

```json
{
  "schemaVersion": "1.0.0",
  "eventId": "evt-0001",
  "eventType": "evidence_recorded",
  "workerId": "W01",
  "claimId": "C1",
  "claimText": "Claim summary",
  "sourceId": "S-1001",
  "evidence": "Evidence excerpt",
  "counterpoint": "Known caveat",
  "implication": "What this means",
  "actionability": "Recommended action",
  "confidence": 0.82,
  "occurredAt": "2026-03-06T10:00:00Z"
}
```

Rules:

- Use `python3 scripts/worker_journal_append.py` so `sequence`, `previousEventHash`, and `eventHash` are generated deterministically.
- Event payloads must never include reserved fields: `sequence`, `previousEventHash`, `eventHash`.
- Corrections use `eventType` values like `correction_recorded` and append only.
- Existing lines remain unchanged.
