import type Database from 'better-sqlite3';
import type { LifecycleEvent, LifecycleEventRow, EventDetails } from '@/lib/types';
import { getDatabase, parseDate, parseJson } from '@/lib/db';
import { generateId, safeJsonStringify } from '@/lib/utils';

export class LifecycleEventRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database || getDatabase();
  }

  /**
   * Create a new lifecycle event
   */
  create(data: Omit<LifecycleEvent, 'id' | 'createdAt'>): LifecycleEvent {
    const id = generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO lifecycle_events (
        id, case_study_id, ticket_key, event_type, event_source, event_date,
        actor_name, actor_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.caseStudyId,
      data.ticketKey,
      data.eventType,
      data.eventSource,
      data.eventDate.toISOString(),
      data.actorName,
      data.actorId || null,
      safeJsonStringify(data.details),
      now
    );

    return {
      ...data,
      id,
      createdAt: new Date(now),
    };
  }

  /**
   * Create multiple events in a transaction
   */
  createMany(events: Omit<LifecycleEvent, 'id' | 'createdAt'>[]): LifecycleEvent[] {
    const insertMany = this.db.transaction(
      (eventsToInsert: Omit<LifecycleEvent, 'id' | 'createdAt'>[]) => {
        const created: LifecycleEvent[] = [];
        for (const event of eventsToInsert) {
          created.push(this.create(event));
        }
        return created;
      }
    );

    return insertMany(events);
  }

  /**
   * Find event by ID
   */
  findById(id: string): LifecycleEvent | undefined {
    const stmt = this.db.prepare('SELECT * FROM lifecycle_events WHERE id = ?');
    const row = stmt.get(id) as LifecycleEventRow | undefined;

    return row ? this.mapRowToEvent(row) : undefined;
  }

  /**
   * Find all events for a case study
   */
  findByCaseStudy(caseStudyId: string): LifecycleEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM lifecycle_events WHERE case_study_id = ? ORDER BY event_date ASC'
    );
    const rows = stmt.all(caseStudyId) as LifecycleEventRow[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Find events for a specific ticket
   */
  findByTicket(ticketKey: string): LifecycleEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM lifecycle_events WHERE ticket_key = ? ORDER BY event_date ASC'
    );
    const rows = stmt.all(ticketKey) as LifecycleEventRow[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Find events by type
   */
  findByType(caseStudyId: string, eventType: string): LifecycleEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM lifecycle_events WHERE case_study_id = ? AND event_type = ? ORDER BY event_date ASC'
    );
    const rows = stmt.all(caseStudyId, eventType) as LifecycleEventRow[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Find events by source
   */
  findBySource(caseStudyId: string, source: 'jira' | 'github'): LifecycleEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM lifecycle_events WHERE case_study_id = ? AND event_source = ? ORDER BY event_date ASC'
    );
    const rows = stmt.all(caseStudyId, source) as LifecycleEventRow[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Find events within a date range
   */
  findByDateRange(caseStudyId: string, startDate: Date, endDate: Date): LifecycleEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM lifecycle_events
      WHERE case_study_id = ? AND event_date >= ? AND event_date <= ?
      ORDER BY event_date ASC
    `);
    const rows = stmt.all(
      caseStudyId,
      startDate.toISOString(),
      endDate.toISOString()
    ) as LifecycleEventRow[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Get timeline of events for a ticket (ordered by date)
   */
  getTicketTimeline(ticketKey: string): LifecycleEvent[] {
    return this.findByTicket(ticketKey);
  }

  /**
   * Get all events grouped by ticket for a case study
   */
  getTimelineByTickets(caseStudyId: string): Map<string, LifecycleEvent[]> {
    const events = this.findByCaseStudy(caseStudyId);
    const map = new Map<string, LifecycleEvent[]>();

    for (const event of events) {
      const ticketEvents = map.get(event.ticketKey) || [];
      ticketEvents.push(event);
      map.set(event.ticketKey, ticketEvents);
    }

    return map;
  }

  /**
   * Delete event
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM lifecycle_events WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Delete all events for a case study (usually handled by cascade)
   */
  deleteByCaseStudy(caseStudyId: string): number {
    const stmt = this.db.prepare('DELETE FROM lifecycle_events WHERE case_study_id = ?');
    const result = stmt.run(caseStudyId);

    return result.changes;
  }

  /**
   * Count events by type for a case study
   */
  countByType(caseStudyId: string): Map<string, number> {
    const stmt = this.db.prepare(
      'SELECT event_type, COUNT(*) as count FROM lifecycle_events WHERE case_study_id = ? GROUP BY event_type'
    );
    const rows = stmt.all(caseStudyId) as { event_type: string; count: number }[];

    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.event_type, row.count));

    return map;
  }

  /**
   * Count events by source for a case study
   */
  countBySource(caseStudyId: string): { jira: number; github: number } {
    const stmt = this.db.prepare(
      'SELECT event_source, COUNT(*) as count FROM lifecycle_events WHERE case_study_id = ? GROUP BY event_source'
    );
    const rows = stmt.all(caseStudyId) as { event_source: string; count: number }[];

    const result = { jira: 0, github: 0 };
    rows.forEach(row => {
      if (row.event_source === 'jira') result.jira = row.count;
      if (row.event_source === 'github') result.github = row.count;
    });

    return result;
  }

  /**
   * Map database row to LifecycleEvent entity
   */
  private mapRowToEvent(row: LifecycleEventRow): LifecycleEvent {
    return {
      id: row.id,
      caseStudyId: row.case_study_id,
      ticketKey: row.ticket_key,
      eventType: row.event_type as LifecycleEvent['eventType'],
      eventSource: row.event_source as 'jira' | 'github',
      eventDate: parseDate(row.event_date) || new Date(),
      actorName: row.actor_name,
      actorId: row.actor_id || undefined,
      details: (parseJson<EventDetails>(row.details) || {}) as EventDetails,
      createdAt: parseDate(row.created_at) || new Date(),
    };
  }
}
