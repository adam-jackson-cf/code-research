import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { JiraImportService } from '@/lib/services/jira-import.service';
import { JiraTicketRepository } from '@/lib/repositories/jira-ticket.repository';
import { LifecycleEventRepository } from '@/lib/repositories/lifecycle-event.repository';
import { CaseStudyRepository } from '@/lib/repositories/case-study.repository';
import { mockIssues, mockChangelog19734 } from '@/tests/fixtures/jira/mock-issues';

describe('JiraImportService', () => {
  let db: Database.Database;
  let jiraImportService: JiraImportService;
  let jiraTicketRepo: JiraTicketRepository;
  let lifecycleEventRepo: LifecycleEventRepository;
  let caseStudyRepo: CaseStudyRepository;
  let caseStudyId: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Initialize schema
    db.pragma('foreign_keys = ON');
    const schemaPath = path.join(__dirname, '../../lib/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Create repositories
    jiraTicketRepo = new JiraTicketRepository(db);
    lifecycleEventRepo = new LifecycleEventRepository(db);
    caseStudyRepo = new CaseStudyRepository(db);

    // Create service
    jiraImportService = new JiraImportService(jiraTicketRepo, lifecycleEventRepo, caseStudyRepo);

    // Create a test case study
    const caseStudy = caseStudyRepo.create({
      name: 'Test Case Study',
      type: 'project',
      jiraProjectKey: 'KAFKA',
      githubOwner: 'apache',
      githubRepo: 'kafka',
      importedAt: new Date(),
      ticketCount: 0,
      eventCount: 0,
      startDate: new Date(),
      endDate: new Date(),
      status: 'importing',
    });
    caseStudyId = caseStudy.id;
  });

  afterEach(() => {
    db.close();
  });

  it('should import Jira issues and create tickets', async () => {
    // Import first 3 mock issues
    const issuesToImport = mockIssues.slice(0, 3);
    await jiraImportService.importIssues(caseStudyId, issuesToImport);

    // Verify tickets were created
    const tickets = jiraTicketRepo.findByCaseStudy(caseStudyId);
    expect(tickets).toHaveLength(3);

    // Verify first ticket
    const firstTicket = tickets.find(t => t.jiraKey === 'KAFKA-19734');
    expect(firstTicket).toBeDefined();
    expect(firstTicket?.summary).toBe('Updating the docs for KIP-1221');
    expect(firstTicket?.issueType).toBe('Story');
    expect(firstTicket?.statusCategory).toBe('Done');
    expect(firstTicket?.storyPoints).toBe(5);
  });

  it('should create lifecycle events for ticket creation', async () => {
    const issuesToImport = mockIssues.slice(0, 2);
    await jiraImportService.importIssues(caseStudyId, issuesToImport);

    // Verify events were created
    const events = lifecycleEventRepo.findByCaseStudy(caseStudyId);
    expect(events.length).toBeGreaterThanOrEqual(2); // At least ticket_created events

    // Verify ticket_created event
    const createdEvent = events.find(
      e => e.eventType === 'ticket_created' && e.ticketKey === 'KAFKA-19734'
    );
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.eventSource).toBe('jira');
    expect(createdEvent?.actorName).toBe('Jane Reporter');
  });

  it('should create resolved events for completed tickets', async () => {
    // Use a resolved ticket
    const resolvedIssue = mockIssues.find(i => i.fields.resolutiondate);
    expect(resolvedIssue).toBeDefined();

    if (resolvedIssue) {
      await jiraImportService.importIssues(caseStudyId, [resolvedIssue]);

      const events = lifecycleEventRepo.findByTicket(resolvedIssue.key);
      const resolvedEvent = events.find(e => e.eventType === 'resolved');

      expect(resolvedEvent).toBeDefined();
      expect(resolvedEvent?.eventSource).toBe('jira');
    }
  });

  it('should import changelog and create status change events', async () => {
    // First import the issue
    const issue = mockIssues[0];
    await jiraImportService.importIssues(caseStudyId, [issue]);

    // Then import changelog
    await jiraImportService.importChangelogs(
      caseStudyId,
      mockChangelog19734.key,
      mockChangelog19734.changelog.histories
    );

    // Verify status change events were created
    const events = lifecycleEventRepo.findByTicket(mockChangelog19734.key);
    const statusEvents = events.filter(e => e.eventType === 'status_changed');

    expect(statusEvents.length).toBeGreaterThan(0);

    // Verify first status change (To Do → In Progress)
    const firstStatusChange = statusEvents.find(e => e.details.toStatus === 'In Progress');
    expect(firstStatusChange).toBeDefined();
    expect(firstStatusChange?.details.fromStatus).toBe('To Do');
  });

  it('should update case study with ticket and event counts', async () => {
    const issuesToImport = mockIssues.slice(0, 5);
    await jiraImportService.importIssues(caseStudyId, issuesToImport);

    const caseStudy = caseStudyRepo.findById(caseStudyId);
    expect(caseStudy?.ticketCount).toBe(5);
    expect(caseStudy?.eventCount).toBeGreaterThan(0);
    expect(caseStudy?.status).toBe('completed');
  });

  it('should handle import errors gracefully', async () => {
    // Create invalid issue data
    const invalidIssue = { ...mockIssues[0], fields: null };

    await expect(
      jiraImportService.importIssues(caseStudyId, [
        invalidIssue as unknown as import('@/tests/fixtures/jira/mock-issues').JiraIssue,
      ])
    ).rejects.toThrow();

    // Verify case study status is set to error
    const caseStudy = caseStudyRepo.findById(caseStudyId);
    expect(caseStudy?.status).toBe('error');
    expect(caseStudy?.errorMessage).toBeDefined();
  });

  it('should group tickets by status category', async () => {
    await jiraImportService.importIssues(caseStudyId, mockIssues);

    const doneTickets = jiraTicketRepo.findByStatusCategory(caseStudyId, 'Done');
    const inProgressTickets = jiraTicketRepo.findByStatusCategory(caseStudyId, 'In Progress');
    const todoTickets = jiraTicketRepo.findByStatusCategory(caseStudyId, 'To Do');

    expect(doneTickets.length).toBeGreaterThan(0);
    expect(inProgressTickets.length).toBeGreaterThan(0);
    expect(todoTickets.length).toBeGreaterThan(0);

    // Verify total
    const total = doneTickets.length + inProgressTickets.length + todoTickets.length;
    expect(total).toBe(mockIssues.length);
  });

  it('should correctly map Jira issue types', async () => {
    await jiraImportService.importIssues(caseStudyId, mockIssues);

    const tickets = jiraTicketRepo.findByCaseStudy(caseStudyId);

    // Verify different issue types are present
    const issueTypes = new Set(tickets.map(t => t.issueType));
    expect(issueTypes.has('Story')).toBe(true);
    expect(issueTypes.has('Bug')).toBe(true);
    expect(issueTypes.has('Task')).toBe(true);
  });
});
