import type Database from 'better-sqlite3';
import type { CaseStudy, CaseStudyRow } from '@/lib/types';
import { getDatabase, parseDate } from '@/lib/db';
import { generateId } from '@/lib/utils';

export class CaseStudyRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database || getDatabase();
  }

  /**
   * Create a new case study
   */
  create(data: Omit<CaseStudy, 'id' | 'createdAt'>): CaseStudy {
    const id = generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO case_studies (
        id, name, type, jira_project_key, jira_project_id, jira_sprint_id, jira_ticket_key,
        github_owner, github_repo, imported_at, imported_by, ticket_count, event_count,
        start_date, end_date, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.type,
      data.jiraProjectKey,
      data.jiraProjectId || null,
      data.jiraSprintId || null,
      data.jiraTicketKey || null,
      data.githubOwner,
      data.githubRepo,
      data.importedAt.toISOString(),
      data.importedBy || null,
      data.ticketCount,
      data.eventCount,
      data.startDate.toISOString(),
      data.endDate.toISOString(),
      data.status,
      data.errorMessage || null,
      now
    );

    return {
      ...data,
      id,
    };
  }

  /**
   * Find case study by ID
   */
  findById(id: string): CaseStudy | undefined {
    const stmt = this.db.prepare('SELECT * FROM case_studies WHERE id = ?');
    const row = stmt.get(id) as CaseStudyRow | undefined;

    return row ? this.mapRowToCaseStudy(row) : undefined;
  }

  /**
   * Find all case studies
   */
  findAll(): CaseStudy[] {
    const stmt = this.db.prepare('SELECT * FROM case_studies ORDER BY created_at DESC');
    const rows = stmt.all() as CaseStudyRow[];

    return rows.map(row => this.mapRowToCaseStudy(row));
  }

  /**
   * Find case studies by status
   */
  findByStatus(status: CaseStudy['status']): CaseStudy[] {
    const stmt = this.db.prepare(
      'SELECT * FROM case_studies WHERE status = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(status) as CaseStudyRow[];

    return rows.map(row => this.mapRowToCaseStudy(row));
  }

  /**
   * Find case studies by type
   */
  findByType(type: CaseStudy['type']): CaseStudy[] {
    const stmt = this.db.prepare(
      'SELECT * FROM case_studies WHERE type = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(type) as CaseStudyRow[];

    return rows.map(row => this.mapRowToCaseStudy(row));
  }

  /**
   * Update case study
   */
  update(id: string, updates: Partial<Omit<CaseStudy, 'id'>>): CaseStudy | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.ticketCount !== undefined) {
      fields.push('ticket_count = ?');
      values.push(updates.ticketCount);
    }
    if (updates.eventCount !== undefined) {
      fields.push('event_count = ?');
      values.push(updates.eventCount);
    }
    if (updates.startDate !== undefined) {
      fields.push('start_date = ?');
      values.push(updates.startDate.toISOString());
    }
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.endDate.toISOString());
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE case_studies SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  /**
   * Delete case study (cascades to related data)
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM case_studies WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Get count of case studies by status
   */
  countByStatus(): Map<CaseStudy['status'], number> {
    const stmt = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM case_studies GROUP BY status'
    );
    const rows = stmt.all() as { status: CaseStudy['status']; count: number }[];

    const map = new Map<CaseStudy['status'], number>();
    rows.forEach(row => map.set(row.status, row.count));

    return map;
  }

  /**
   * Map database row to CaseStudy entity
   */
  private mapRowToCaseStudy(row: CaseStudyRow): CaseStudy {
    return {
      id: row.id,
      name: row.name,
      type: row.type as CaseStudy['type'],
      jiraProjectKey: row.jira_project_key,
      jiraProjectId: row.jira_project_id || undefined,
      jiraSprintId: row.jira_sprint_id || undefined,
      jiraTicketKey: row.jira_ticket_key || undefined,
      githubOwner: row.github_owner,
      githubRepo: row.github_repo,
      importedAt: parseDate(row.imported_at) || new Date(),
      importedBy: row.imported_by || undefined,
      ticketCount: row.ticket_count,
      eventCount: row.event_count,
      startDate: parseDate(row.start_date) || new Date(),
      endDate: parseDate(row.end_date) || new Date(),
      status: row.status as CaseStudy['status'],
      errorMessage: row.error_message || undefined,
    };
  }
}
