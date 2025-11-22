import type { JiraTicket, LifecycleEvent, EventType } from '@/lib/types';
import type { JiraIssue, JiraChangelogHistory } from '@/tests/fixtures/jira/mock-issues';
import { JiraTicketRepository } from '@/lib/repositories/jira-ticket.repository';
import { LifecycleEventRepository } from '@/lib/repositories/lifecycle-event.repository';
import { CaseStudyRepository } from '@/lib/repositories/case-study.repository';
import { EventType as EventTypeEnum } from '@/lib/types';
import { calculateTimeDiff } from '@/lib/utils';

export class JiraImportService {
  constructor(
    private jiraTicketRepo: JiraTicketRepository,
    private lifecycleEventRepo: LifecycleEventRepository,
    private caseStudyRepo: CaseStudyRepository
  ) {}

  /**
   * Import Jira issues for a case study
   */
  async importIssues(caseStudyId: string, issues: JiraIssue[]): Promise<void> {
    // Update case study status to importing
    this.caseStudyRepo.update(caseStudyId, { status: 'importing' });

    try {
      const tickets: Omit<JiraTicket, 'id'>[] = [];
      const events: Omit<LifecycleEvent, 'id' | 'createdAt'>[] = [];

      for (const issue of issues) {
        // Convert Jira issue to our ticket format
        const ticket = this.convertIssueToTicket(issue, caseStudyId);
        tickets.push(ticket);

        // Create ticket creation event
        events.push({
          caseStudyId,
          ticketKey: issue.key,
          eventType: EventTypeEnum.TICKET_CREATED,
          eventSource: 'jira',
          eventDate: new Date(issue.fields.created),
          actorName: issue.fields.reporter.displayName,
          actorId: issue.fields.reporter.accountId,
          details: {
            metadata: {
              summary: issue.fields.summary,
              issueType: issue.fields.issuetype.name,
              priority: issue.fields.priority.name,
            },
          },
        });

        // Add resolved event if ticket is resolved
        if (issue.fields.resolutiondate) {
          events.push({
            caseStudyId,
            ticketKey: issue.key,
            eventType: EventTypeEnum.RESOLVED,
            eventSource: 'jira',
            eventDate: new Date(issue.fields.resolutiondate),
            actorName: issue.fields.assignee?.displayName || 'Unknown',
            actorId: issue.fields.assignee?.accountId,
            details: {},
          });
        }
      }

      // Batch insert tickets and events
      this.jiraTicketRepo.createMany(tickets);
      this.lifecycleEventRepo.createMany(events);

      // Calculate date range
      const dates = issues.map(i => new Date(i.fields.created).getTime());
      const startDate = new Date(Math.min(...dates));
      const endDate = new Date(Math.max(...dates));

      // Update case study
      this.caseStudyRepo.update(caseStudyId, {
        status: 'completed',
        ticketCount: issues.length,
        eventCount: events.length,
        startDate,
        endDate,
      });
    } catch (error) {
      // Update case study with error
      this.caseStudyRepo.update(caseStudyId, {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Import changelog for issues to create lifecycle events
   */
  async importChangelogs(
    caseStudyId: string,
    issueKey: string,
    histories: JiraChangelogHistory[]
  ): Promise<void> {
    const events: Omit<LifecycleEvent, 'id' | 'createdAt'>[] = [];

    for (const history of histories) {
      for (const item of history.items) {
        let eventType: EventType | null = null;
        const details: LifecycleEvent['details'] = {};

        if (item.field === 'status') {
          eventType = EventTypeEnum.STATUS_CHANGED;
          details.fromStatus = item.fromString || undefined;
          details.toStatus = item.toString || undefined;
        } else if (item.field === 'assignee') {
          eventType = EventTypeEnum.ASSIGNEE_CHANGED;
        }

        if (eventType) {
          events.push({
            caseStudyId,
            ticketKey: issueKey,
            eventType,
            eventSource: 'jira',
            eventDate: new Date(history.created),
            actorName: 'Jira User', // Would come from history author in real API
            details,
          });
        }
      }
    }

    if (events.length > 0) {
      this.lifecycleEventRepo.createMany(events);

      // Update event count in case study
      const caseStudy = this.caseStudyRepo.findById(caseStudyId);
      if (caseStudy) {
        this.caseStudyRepo.update(caseStudyId, {
          eventCount: caseStudy.eventCount + events.length,
        });
      }
    }
  }

  /**
   * Calculate metrics for tickets
   */
  async calculateMetrics(caseStudyId: string): Promise<void> {
    const tickets = this.jiraTicketRepo.findByCaseStudy(caseStudyId);

    for (const ticket of tickets) {
      const events = this.lifecycleEventRepo.findByTicket(ticket.jiraKey);

      // Calculate lead time (created to resolved)
      if (ticket.resolvedAt) {
        const leadTime = calculateTimeDiff(ticket.createdAt, ticket.resolvedAt);
        ticket.leadTime = leadTime;
      }

      // Calculate cycle time (in progress to done)
      const inProgressEvent = events.find(
        e =>
          e.eventType === EventTypeEnum.STATUS_CHANGED && e.details.toStatus?.includes('Progress')
      );
      const doneEvent = events.find(
        e => e.eventType === EventTypeEnum.STATUS_CHANGED && e.details.toStatus?.includes('Done')
      );

      if (inProgressEvent && doneEvent) {
        const cycleTime = calculateTimeDiff(inProgressEvent.eventDate, doneEvent.eventDate);
        ticket.cycleTime = cycleTime;
      }

      // Update ticket with metrics
      this.jiraTicketRepo.update(ticket.id, {
        leadTime: ticket.leadTime,
        cycleTime: ticket.cycleTime,
      });
    }
  }

  /**
   * Convert Jira API issue to our ticket format
   */
  private convertIssueToTicket(issue: JiraIssue, caseStudyId: string): Omit<JiraTicket, 'id'> {
    // Determine status category
    const statusCategory =
      issue.fields.status.statusCategory.key === 'done'
        ? 'Done'
        : issue.fields.status.statusCategory.key === 'new'
          ? 'To Do'
          : 'In Progress';

    return {
      caseStudyId,
      jiraId: issue.id,
      jiraKey: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      issueType: issue.fields.issuetype.name,
      priority: issue.fields.priority.name,
      currentStatus: issue.fields.status.name,
      statusCategory: statusCategory as JiraTicket['statusCategory'],
      assigneeId: issue.fields.assignee?.accountId,
      assigneeName: issue.fields.assignee?.displayName,
      reporterId: issue.fields.reporter.accountId,
      reporterName: issue.fields.reporter.displayName,
      sprintId: issue.fields.customfield_10104,
      sprintName: issue.fields.customfield_10104,
      storyPoints: issue.fields.customfield_10016,
      createdAt: new Date(issue.fields.created),
      updatedAt: new Date(issue.fields.updated),
      resolvedAt: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : undefined,
      rawJiraData: issue,
    };
  }
}
