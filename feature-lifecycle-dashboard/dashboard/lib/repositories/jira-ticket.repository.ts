import type Database from 'better-sqlite3';
import type { JiraTicket, JiraTicketRow } from '@/lib/types';
import { getDatabase, parseDate, parseJson } from '@/lib/db';
import { generateId, safeJsonStringify } from '@/lib/utils';

export class JiraTicketRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database || getDatabase();
  }

  /**
   * Create a new Jira ticket
   */
  create(data: Omit<JiraTicket, 'id'>): JiraTicket {
    const id = generateId();

    const stmt = this.db.prepare(`
      INSERT INTO jira_tickets (
        id, case_study_id, jira_id, jira_key, summary, description, issue_type, priority,
        current_status, status_category, assignee_id, assignee_name, reporter_id, reporter_name,
        sprint_id, sprint_name, story_points, created_at, updated_at, resolved_at, due_date,
        lead_time, cycle_time, raw_jira_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.caseStudyId,
      data.jiraId,
      data.jiraKey,
      data.summary,
      data.description || null,
      data.issueType,
      data.priority,
      data.currentStatus,
      data.statusCategory,
      data.assigneeId || null,
      data.assigneeName || null,
      data.reporterId || null,
      data.reporterName || null,
      data.sprintId || null,
      data.sprintName || null,
      data.storyPoints || null,
      data.createdAt.toISOString(),
      data.updatedAt.toISOString(),
      data.resolvedAt?.toISOString() || null,
      data.dueDate?.toISOString() || null,
      data.leadTime || null,
      data.cycleTime || null,
      safeJsonStringify(data.rawJiraData)
    );

    return { ...data, id };
  }

  /**
   * Create multiple tickets in a transaction
   */
  createMany(tickets: Omit<JiraTicket, 'id'>[]): JiraTicket[] {
    const insertMany = this.db.transaction((ticketsToInsert: Omit<JiraTicket, 'id'>[]) => {
      const created: JiraTicket[] = [];
      for (const ticket of ticketsToInsert) {
        created.push(this.create(ticket));
      }
      return created;
    });

    return insertMany(tickets);
  }

  /**
   * Find ticket by ID
   */
  findById(id: string): JiraTicket | undefined {
    const stmt = this.db.prepare('SELECT * FROM jira_tickets WHERE id = ?');
    const row = stmt.get(id) as JiraTicketRow | undefined;

    return row ? this.mapRowToTicket(row) : undefined;
  }

  /**
   * Find ticket by Jira key
   */
  findByKey(jiraKey: string): JiraTicket | undefined {
    const stmt = this.db.prepare('SELECT * FROM jira_tickets WHERE jira_key = ?');
    const row = stmt.get(jiraKey) as JiraTicketRow | undefined;

    return row ? this.mapRowToTicket(row) : undefined;
  }

  /**
   * Find all tickets for a case study
   */
  findByCaseStudy(caseStudyId: string): JiraTicket[] {
    const stmt = this.db.prepare(
      'SELECT * FROM jira_tickets WHERE case_study_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(caseStudyId) as JiraTicketRow[];

    return rows.map(row => this.mapRowToTicket(row));
  }

  /**
   * Find tickets by status
   */
  findByStatus(caseStudyId: string, status: string): JiraTicket[] {
    const stmt = this.db.prepare(
      'SELECT * FROM jira_tickets WHERE case_study_id = ? AND current_status = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(caseStudyId, status) as JiraTicketRow[];

    return rows.map(row => this.mapRowToTicket(row));
  }

  /**
   * Find tickets by status category
   */
  findByStatusCategory(caseStudyId: string, category: JiraTicket['statusCategory']): JiraTicket[] {
    const stmt = this.db.prepare(
      'SELECT * FROM jira_tickets WHERE case_study_id = ? AND status_category = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(caseStudyId, category) as JiraTicketRow[];

    return rows.map(row => this.mapRowToTicket(row));
  }

  /**
   * Find tickets by sprint
   */
  findBySprint(caseStudyId: string, sprintId: string): JiraTicket[] {
    const stmt = this.db.prepare(
      'SELECT * FROM jira_tickets WHERE case_study_id = ? AND sprint_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(caseStudyId, sprintId) as JiraTicketRow[];

    return rows.map(row => this.mapRowToTicket(row));
  }

  /**
   * Update ticket
   */
  update(
    id: string,
    updates: Partial<Omit<JiraTicket, 'id' | 'caseStudyId' | 'jiraId' | 'jiraKey'>>
  ): JiraTicket | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.currentStatus !== undefined) {
      fields.push('current_status = ?');
      values.push(updates.currentStatus);
    }
    if (updates.statusCategory !== undefined) {
      fields.push('status_category = ?');
      values.push(updates.statusCategory);
    }
    if (updates.resolvedAt !== undefined) {
      fields.push('resolved_at = ?');
      values.push(updates.resolvedAt?.toISOString() || null);
    }
    if (updates.leadTime !== undefined) {
      fields.push('lead_time = ?');
      values.push(updates.leadTime);
    }
    if (updates.cycleTime !== undefined) {
      fields.push('cycle_time = ?');
      values.push(updates.cycleTime);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE jira_tickets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  /**
   * Delete ticket
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM jira_tickets WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Get ticket count by status for a case study
   */
  countByStatus(caseStudyId: string): Map<string, number> {
    const stmt = this.db.prepare(
      'SELECT current_status, COUNT(*) as count FROM jira_tickets WHERE case_study_id = ? GROUP BY current_status'
    );
    const rows = stmt.all(caseStudyId) as { current_status: string; count: number }[];

    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.current_status, row.count));

    return map;
  }

  /**
   * Calculate average metrics for a case study
   */
  getAverageMetrics(caseStudyId: string): {
    avgLeadTime: number;
    avgCycleTime: number;
    avgStoryPoints: number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        AVG(lead_time) as avg_lead_time,
        AVG(cycle_time) as avg_cycle_time,
        AVG(story_points) as avg_story_points
      FROM jira_tickets
      WHERE case_study_id = ? AND resolved_at IS NOT NULL
    `);

    const row = stmt.get(caseStudyId) as {
      avg_lead_time: number | null;
      avg_cycle_time: number | null;
      avg_story_points: number | null;
    };

    return {
      avgLeadTime: row.avg_lead_time || 0,
      avgCycleTime: row.avg_cycle_time || 0,
      avgStoryPoints: row.avg_story_points || 0,
    };
  }

  /**
   * Map database row to JiraTicket entity
   */
  private mapRowToTicket(row: JiraTicketRow): JiraTicket {
    return {
      id: row.id,
      caseStudyId: row.case_study_id,
      jiraId: row.jira_id,
      jiraKey: row.jira_key,
      summary: row.summary,
      description: row.description || undefined,
      issueType: row.issue_type,
      priority: row.priority,
      currentStatus: row.current_status,
      statusCategory: row.status_category as JiraTicket['statusCategory'],
      assigneeId: row.assignee_id || undefined,
      assigneeName: row.assignee_name || undefined,
      reporterId: row.reporter_id || undefined,
      reporterName: row.reporter_name || undefined,
      sprintId: row.sprint_id || undefined,
      sprintName: row.sprint_name || undefined,
      storyPoints: row.story_points || undefined,
      createdAt: parseDate(row.created_at) || new Date(),
      updatedAt: parseDate(row.updated_at) || new Date(),
      resolvedAt: parseDate(row.resolved_at),
      dueDate: parseDate(row.due_date),
      leadTime: row.lead_time || undefined,
      cycleTime: row.cycle_time || undefined,
      rawJiraData: parseJson(row.raw_jira_data) || {},
    };
  }
}
