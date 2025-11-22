import { Octokit } from 'octokit';
import type { GitHubCommit, LifecycleEvent, EventType } from '@/lib/types';
import { LifecycleEventRepository } from '@/lib/repositories/lifecycle-event.repository';
import { CaseStudyRepository } from '@/lib/repositories/case-study.repository';
import { EventType as EventTypeEnum } from '@/lib/types';
import { extractTicketIds, generateId } from '@/lib/utils';

export interface GitHubCommitData {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export class GitHubImportService {
  private octokit: Octokit;

  constructor(
    private lifecycleEventRepo: LifecycleEventRepository,
    private caseStudyRepo: CaseStudyRepository,
    githubToken?: string
  ) {
    this.octokit = new Octokit({ auth: githubToken });
  }

  /**
   * Import commits for a case study from a GitHub repository
   */
  async importCommits(
    caseStudyId: string,
    owner: string,
    repo: string,
    options: {
      since?: Date;
      until?: Date;
      perPage?: number;
      maxCommits?: number;
    } = {}
  ): Promise<number> {
    const { since, until, perPage = 100, maxCommits = 500 } = options;

    const events: Omit<LifecycleEvent, 'id' | 'createdAt'>[] = [];
    let page = 1;
    let totalCommits = 0;

    try {
      while (totalCommits < maxCommits) {
        const params: {
          owner: string;
          repo: string;
          per_page: number;
          page: number;
          since?: string;
          until?: string;
        } = {
          owner,
          repo,
          per_page: perPage,
          page,
        };

        if (since) params.since = since.toISOString();
        if (until) params.until = until.toISOString();

        const response = await this.octokit.rest.repos.listCommits(params);

        if (response.data.length === 0) break;

        for (const commit of response.data) {
          // Extract ticket IDs from commit message
          const ticketIds = extractTicketIds(commit.commit.message);

          if (ticketIds.length > 0) {
            const commitData = commit as unknown as GitHubCommitData;

            // Create an event for each ticket ID mentioned in the commit
            for (const ticketKey of ticketIds) {
              events.push({
                caseStudyId,
                ticketKey,
                eventType: EventTypeEnum.COMMIT_CREATED,
                eventSource: 'github',
                eventDate: new Date(commitData.commit.author.date),
                actorName: commitData.commit.author.name,
                actorId: commitData.author?.login,
                details: {
                  commitSha: commitData.sha,
                  commitMessage: commitData.commit.message,
                  commitUrl: commitData.html_url,
                  metadata: {
                    email: commitData.commit.author.email,
                  },
                },
              });
            }

            totalCommits++;
            if (totalCommits >= maxCommits) break;
          }
        }

        page++;
      }

      // Batch insert events
      if (events.length > 0) {
        this.lifecycleEventRepo.createMany(events);

        // Update case study event count
        const caseStudy = this.caseStudyRepo.findById(caseStudyId);
        if (caseStudy) {
          this.caseStudyRepo.update(caseStudyId, {
            eventCount: caseStudy.eventCount + events.length,
          });
        }
      }

      return events.length;
    } catch (error) {
      const caseStudy = this.caseStudyRepo.findById(caseStudyId);
      if (caseStudy) {
        this.caseStudyRepo.update(caseStudyId, {
          status: 'error',
          errorMessage: `GitHub import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
      throw error;
    }
  }

  /**
   * Import a specific commit with full details
   */
  async importCommitDetails(
    caseStudyId: string,
    owner: string,
    repo: string,
    sha: string
  ): Promise<GitHubCommitData> {
    const response = await this.octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });

    return response.data as unknown as GitHubCommitData;
  }
}
