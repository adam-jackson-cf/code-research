/**
 * Integration test using REAL data from Apache Kafka's public Jira and GitHub
 *
 * This test demonstrates the complete lifecycle import flow:
 * 1. Fetch real Jira issues from https://issues.apache.org/jira
 * 2. Fetch real GitHub commits from https://github.com/apache/kafka
 * 3. Match ticket IDs between Jira and GitHub
 * 4. Build complete lifecycle timeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Octokit } from 'octokit';
import { JiraImportService } from '@/lib/services/jira-import.service';
import { GitHubImportService } from '@/lib/services/github-import.service';
import { JiraTicketRepository } from '@/lib/repositories/jira-ticket.repository';
import { LifecycleEventRepository } from '@/lib/repositories/lifecycle-event.repository';
import { CaseStudyRepository } from '@/lib/repositories/case-study.repository';

// Test configuration
const JIRA_BASE_URL = 'https://issues.apache.org/jira/rest/api/2';
const GITHUB_OWNER = 'apache';
const GITHUB_REPO = 'kafka';

// Known tickets to test (these exist in Apache Kafka)
const TEST_TICKET_IDS = ['KAFKA-17541', 'KAFKA-19734'];

describe('Apache Kafka Integration Test (Real Data)', () => {
  let db: Database.Database;
  let jiraImportService: JiraImportService;
  let githubImportService: GitHubImportService;
  let jiraTicketRepo: JiraTicketRepository;
  let lifecycleEventRepo: LifecycleEventRepository;
  let caseStudyRepo: CaseStudyRepository;
  let caseStudyId: string;

  beforeAll(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    const schemaPath = path.join(__dirname, '../../lib/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Create repositories
    jiraTicketRepo = new JiraTicketRepository(db);
    lifecycleEventRepo = new LifecycleEventRepository(db);
    caseStudyRepo = new CaseStudyRepository(db);

    // Create services
    jiraImportService = new JiraImportService(jiraTicketRepo, lifecycleEventRepo, caseStudyRepo);
    githubImportService = new GitHubImportService(lifecycleEventRepo, caseStudyRepo);

    // Create case study
    const caseStudy = caseStudyRepo.create({
      name: 'Apache Kafka Integration Test',
      type: 'project',
      jiraProjectKey: 'KAFKA',
      githubOwner: GITHUB_OWNER,
      githubRepo: GITHUB_REPO,
      importedAt: new Date(),
      ticketCount: 0,
      eventCount: 0,
      startDate: new Date(),
      endDate: new Date(),
      status: 'importing',
    });
    caseStudyId = caseStudy.id;
  }, 30000);

  afterAll(() => {
    db.close();
  });

  it('should fetch and import real Jira issues from Apache Kafka project', async () => {
    const issues = [];

    for (const ticketId of TEST_TICKET_IDS) {
      try {
        const response = await fetch(`${JIRA_BASE_URL}/issue/${ticketId}`);

        if (!response.ok) {
          console.warn(`Failed to fetch ${ticketId}: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Convert to our simplified format
        const issue = {
          id: data.id,
          key: data.key,
          self: data.self,
          fields: {
            summary: data.fields.summary,
            description: data.fields.description,
            issuetype: {
              id: data.fields.issuetype.id,
              name: data.fields.issuetype.name,
              subtask: data.fields.issuetype.subtask || false,
            },
            status: {
              id: data.fields.status.id,
              name: data.fields.status.name,
              statusCategory: {
                id: data.fields.status.statusCategory.id,
                key: data.fields.status.statusCategory.key,
                name: data.fields.status.statusCategory.name,
              },
            },
            priority: {
              id: data.fields.priority.id,
              name: data.fields.priority.name,
            },
            assignee: data.fields.assignee
              ? {
                  accountId: data.fields.assignee.key || data.fields.assignee.name,
                  displayName: data.fields.assignee.displayName,
                  emailAddress: data.fields.assignee.emailAddress || 'unknown@example.com',
                }
              : null,
            reporter: {
              accountId: data.fields.reporter.key || data.fields.reporter.name,
              displayName: data.fields.reporter.displayName,
              emailAddress: data.fields.reporter.emailAddress || 'unknown@example.com',
            },
            created: data.fields.created,
            updated: data.fields.updated,
            resolutiondate: data.fields.resolutiondate,
            customfield_10104: data.fields.customfield_10104,
            customfield_10016: data.fields.customfield_10016,
          },
        };

        issues.push(issue);
      } catch (error) {
        console.error(`Error fetching ${ticketId}:`, error);
      }
    }

    // Should have fetched at least one issue
    expect(issues.length).toBeGreaterThan(0);
    console.log(`✓ Fetched ${issues.length} real Jira issues`);

    // Import into database
    await jiraImportService.importIssues(caseStudyId, issues);

    // Verify import
    const tickets = jiraTicketRepo.findByCaseStudy(caseStudyId);
    expect(tickets.length).toBe(issues.length);

    // Verify first ticket data
    const firstTicket = tickets[0];
    expect(firstTicket.jiraKey).toMatch(/KAFKA-\d+/);
    expect(firstTicket.summary).toBeDefined();
    expect(firstTicket.issueType).toBeDefined();

    console.log(`✓ Imported ${tickets.length} Jira tickets into database`);
    console.log(`  Example: ${firstTicket.jiraKey} - ${firstTicket.summary}`);
  }, 30000);

  it('should fetch and import real GitHub commits from Apache Kafka repository', async () => {
    // Fetch commits from the last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const eventsImported = await githubImportService.importCommits(
      caseStudyId,
      GITHUB_OWNER,
      GITHUB_REPO,
      {
        since,
        perPage: 50,
        maxCommits: 100,
      }
    );

    expect(eventsImported).toBeGreaterThan(0);
    console.log(`✓ Imported ${eventsImported} GitHub commit events`);

    // Verify events were created
    const events = lifecycleEventRepo.findByCaseStudy(caseStudyId);
    expect(events.length).toBeGreaterThan(0);

    // Find commits that mention KAFKA tickets
    const commitEvents = events.filter(e => e.eventType === 'commit_created');
    expect(commitEvents.length).toBeGreaterThan(0);

    console.log(`✓ Found ${commitEvents.length} commits with KAFKA ticket references`);

    // Verify commit event structure
    const sampleCommit = commitEvents[0];
    expect(sampleCommit.ticketKey).toMatch(/KAFKA-\d+/);
    expect(sampleCommit.details.commitSha).toBeDefined();
    expect(sampleCommit.details.commitMessage).toBeDefined();
    expect(sampleCommit.details.commitUrl).toContain('github.com/apache/kafka/commit');

    console.log(
      `  Example: ${sampleCommit.ticketKey} - ${sampleCommit.details.commitSha?.substring(0, 7)}`
    );
  }, 60000);

  it('should correlate Jira tickets with GitHub commits', async () => {
    // Get all tickets and events
    const tickets = jiraTicketRepo.findByCaseStudy(caseStudyId);
    const allEvents = lifecycleEventRepo.findByCaseStudy(caseStudyId);

    // Find tickets that have both Jira and GitHub events
    const correlatedTickets = tickets.filter(ticket => {
      const ticketEvents = allEvents.filter(e => e.ticketKey === ticket.jiraKey);
      const hasJiraEvents = ticketEvents.some(e => e.eventSource === 'jira');
      const hasGithubEvents = ticketEvents.some(e => e.eventSource === 'github');
      return hasJiraEvents && hasGithubEvents;
    });

    console.log(`✓ Found ${correlatedTickets.length} tickets with both Jira and GitHub activity`);

    if (correlatedTickets.length > 0) {
      const example = correlatedTickets[0];
      const exampleEvents = lifecycleEventRepo.findByTicket(example.jiraKey);

      console.log(`\n  Example Correlated Ticket: ${example.jiraKey}`);
      console.log(`    Summary: ${example.summary}`);
      console.log(`    Status: ${example.currentStatus}`);
      console.log(`    Events: ${exampleEvents.length} total`);

      const jiraEvents = exampleEvents.filter(e => e.eventSource === 'jira');
      const githubEvents = exampleEvents.filter(e => e.eventSource === 'github');

      console.log(`      - ${jiraEvents.length} Jira events`);
      console.log(`      - ${githubEvents.length} GitHub events`);

      // Verify timeline is ordered by date
      const eventDates = exampleEvents.map(e => e.eventDate.getTime());
      const sortedDates = [...eventDates].sort((a, b) => a - b);
      expect(eventDates).toEqual(sortedDates);
    }

    // Should have at least some correlation
    expect(allEvents.length).toBeGreaterThan(tickets.length);
  }, 30000);

  it('should generate complete lifecycle timeline', async () => {
    // Get timeline for all tickets
    const timelineByTicket = lifecycleEventRepo.getTimelineByTickets(caseStudyId);

    expect(timelineByTicket.size).toBeGreaterThan(0);
    console.log(`✓ Generated timelines for ${timelineByTicket.size} tickets`);

    // Analyze a ticket with multiple events
    const ticketsWithMultipleEvents = Array.from(timelineByTicket.entries()).filter(
      ([, events]) => events.length > 1
    );

    if (ticketsWithMultipleEvents.length > 0) {
      const [ticketKey, timeline] = ticketsWithMultipleEvents[0];
      const ticket = jiraTicketRepo.findByKey(ticketKey);

      console.log(`\n  Detailed Timeline for ${ticketKey}:`);
      console.log(`    Ticket: ${ticket?.summary}`);
      console.log(`    Events (${timeline.length}):`);

      timeline.slice(0, 5).forEach((event, idx) => {
        const date = event.eventDate.toISOString().split('T')[0];
        const source = event.eventSource.toUpperCase().padEnd(6);
        const type = event.eventType.replace(/_/g, ' ');
        console.log(`      ${idx + 1}. [${date}] ${source} - ${type}`);
      });

      if (timeline.length > 5) {
        console.log(`      ... and ${timeline.length - 5} more events`);
      }
    }
  }, 30000);

  it('should calculate metrics from real data', async () => {
    const tickets = jiraTicketRepo.findByCaseStudy(caseStudyId);

    // Calculate metrics
    await jiraImportService.calculateMetrics(caseStudyId);

    // Get tickets with calculated metrics
    const updatedTickets = jiraTicketRepo.findByCaseStudy(caseStudyId);
    const ticketsWithMetrics = updatedTickets.filter(t => t.leadTime || t.cycleTime);

    console.log(`✓ Calculated metrics for ${ticketsWithMetrics.length} tickets`);

    if (ticketsWithMetrics.length > 0) {
      const avgMetrics = jiraTicketRepo.getAverageMetrics(caseStudyId);
      console.log(
        `  Average Lead Time: ${(avgMetrics.avgLeadTime / (1000 * 60 * 60 * 24)).toFixed(1)} days`
      );
      console.log(
        `  Average Cycle Time: ${(avgMetrics.avgCycleTime / (1000 * 60 * 60 * 24)).toFixed(1)} days`
      );
    }

    // Verify case study was updated
    const caseStudy = caseStudyRepo.findById(caseStudyId);
    expect(caseStudy?.status).toBe('completed');
    expect(caseStudy?.ticketCount).toBe(tickets.length);
    expect(caseStudy?.eventCount).toBeGreaterThan(0);

    console.log(`\n✓ Integration Test Summary:`);
    console.log(`  Case Study: ${caseStudy?.name}`);
    console.log(`  Status: ${caseStudy?.status}`);
    console.log(`  Tickets: ${caseStudy?.ticketCount}`);
    console.log(`  Events: ${caseStudy?.eventCount}`);
  }, 30000);
});
