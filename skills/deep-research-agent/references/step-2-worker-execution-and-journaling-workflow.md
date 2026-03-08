# Step 2 Workflow: Worker execution and append-only journaling

## Objective

Collect evidence through isolated worker runs while preserving immutable action history.

## Required actions

1. For each worker in `manager/role-lockfile.json`, create `workers/<worker_id>/`.
2. Seed `workers/<worker_id>/journal.jsonl` using [../assets/templates/worker-journal-template.md](../assets/templates/worker-journal-template.md).
3. Execute worker tasks for assigned `question_ids` only.
4. For each operation, write an input payload file and append via:
   - `python3 scripts/worker_journal_append.py --journal-path workers/<worker_id>/journal.jsonl --event-path workers/<worker_id>/next-event.json`
5. Ensure appended events cover:
   - query execution (`eventType=query_executed`)
   - source fetch (`eventType=source_fetched`)
   - extraction (`eventType=evidence_recorded`)
   - correction (`eventType=correction_recorded`)
   - status update (`eventType=status_complete`)
6. Append accepted sources to `workers/<worker_id>/sources.ndjson` with required fields:
   - `source_id`
   - `question_id`
   - `url`
   - `title`
   - `publisher`
   - `published_utc`
   - `captured_utc`
   - `worker_id`
   - `journal_event_id`
7. For corrections, append `eventType=correction_recorded` that references the superseded `eventId`; do not edit older entries.
8. Append a terminal `status_complete` event that includes:
   - `source_count`
   - `claim_count`
   - `unresolved_gaps`
9. Write `manager/worker-status-board.md` with one line per worker (`READY_FOR_REDUCER` or `BLOCKED`).

## Done when

- Every worker has an append-only journal JSONL with contiguous sequences and valid hash chain.
- Every worker has `sources.ndjson` with required metadata fields.
- Every worker has a terminal `status_complete` event.
- Worker status board has no `BLOCKED` workers.
