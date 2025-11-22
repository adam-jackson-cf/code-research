# Integration Tests

This directory contains integration tests that use REAL data from public APIs.

## Real Apache Kafka Integration Test

**File:** `real-apache-kafka.integration.test.ts`

### What it Tests

This integration test demonstrates the complete feature lifecycle tracking system using real data from:
1. **Apache Jira**: https://issues.apache.org/jira
2. **Apache Kafka GitHub**: https://github.com/apache/kafka

### Test Flow

1. **Fetch Real Jira Issues** - Retrieves actual tickets from Apache Kafka's public Jira instance (KAFKA-17541, KAFKA-19734)
2. **Import Jira Data** - Converts real Jira API responses to internal data model
3. **Fetch Real GitHub Commits** - Retrieves recent commits from Apache Kafka repository
4. **Extract Ticket IDs** - Identifies KAFKA-XXXXX references in commit messages
5. **Correlate Data** - Matches Jira tickets with GitHub commits
6. **Build Timeline** - Creates chronological lifecycle events
7. **Calculate Metrics** - Computes lead time and cycle time

### Running the Tests

**Note:** These tests require network access to public APIs. They may not run in sandboxed/offline environments.

```bash
# Run integration tests (requires network access)
npx vitest run --config vitest.integration.config.ts

# Run in an environment with network access
npm run test:integration
```

### API Verification

You can verify the APIs are accessible using curl:

```bash
# Test Jira API
curl "https://issues.apache.org/jira/rest/api/2/issue/KAFKA-19734"

# Test GitHub API
curl "https://api.github.com/repos/apache/kafka/commits?per_page=5"
```

### Expected Behavior

When network access is available, the test should:
- ✅ Fetch 2 real Jira issues
- ✅ Import tickets into database
- ✅ Fetch ~50-100 recent GitHub commits
- ✅ Create lifecycle events for commits referencing KAFKA tickets
- ✅ Correlate tickets with commits
- ✅ Generate complete timeline
- ✅ Calculate metrics (lead time, cycle time)

### Test Output Example

```
✓ Fetched 2 real Jira issues
✓ Imported 2 Jira tickets into database
  Example: KAFKA-19734 - Add application-id as a tag to the ClientState JMX metric

✓ Imported 45 GitHub commit events
✓ Found 45 commits with KAFKA ticket references
  Example: KAFKA-17541 - bcd3191

✓ Found 1 tickets with both Jira and GitHub activity

  Example Correlated Ticket: KAFKA-19734
    Summary: Add application-id as a tag to the ClientState JMX metric
    Status: In Progress
    Events: 3 total
      - 2 Jira events
      - 1 GitHub events

✓ Generated timelines for 2 tickets

  Average Lead Time: 15.3 days
  Average Cycle Time: 8.7 days

✓ Integration Test Summary:
  Case Study: Apache Kafka Integration Test
  Status: completed
  Tickets: 2
  Events: 47
```

### Limitations

- Requires internet connection
- Subject to API rate limits (GitHub: 60 req/hour unauthenticated)
- Test data changes as Apache Kafka project evolves
- Some tests may be sandboxed and unable to make real network requests

### Alternative: Using Mock Data

For environments without network access, use the unit tests which rely on mock fixtures:

```bash
npm run test -- tests/unit/
```

## Adding More Integration Tests

To add integration tests for other projects:

1. Identify public Jira instance (if available)
2. Identify GitHub repository
3. Verify ticket ID pattern in commits
4. Create test file following `real-apache-kafka.integration.test.ts` pattern
5. Update this README

### Other Public Data Sources

**Apache Projects with Public Jira + GitHub:**
- Apache Hadoop
- Apache Flink
- Apache Spark
- Apache Camel

All use the same pattern: `PROJECT-XXXXX` in commit messages.
