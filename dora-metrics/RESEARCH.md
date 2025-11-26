# DORA Metrics Research and Implementation

## Executive Summary

This document summarizes the research conducted on DORA metrics tools and libraries, and the resulting implementation of a TypeScript-based DORA metrics dashboard.

## Research Findings

### Available Open Source Tools

| Tool | Language | Stars | Key Features | Integration |
|------|----------|-------|--------------|-------------|
| [Middleware](https://github.com/middlewarehq/middleware) | TypeScript/Python | 1.5k | Full DORA dashboard, PR-based metrics | GitHub |
| [Dorametrix](https://github.com/mikaelvesavuori/dorametrix) | TypeScript | 76 | Serverless, webhook-based | GitHub, Bitbucket, Jira |
| [Apache DevLake](https://devlake.apache.org/) | Go | 2.5k+ | Comprehensive, Grafana dashboards | GitHub, GitLab, Jira, Jenkins |
| [Four Keys](https://github.com/dora-team/fourkeys) | Python | 2k+ | Official DORA project | GCP-based |
| [Backstage Plugin](https://github.com/backstage/backstage) | TypeScript | 28k+ | Enterprise developer portal integration | Various |

### Commercial Solutions

- **LinearB**: Free unlimited DORA metrics (recommended for quick start)
- **Sleuth**: Deployment-centric with APM integration
- **Faros AI**: 70+ integrations, open-source community edition
- **Jellyfish**: Executive visibility focus
- **Swarmia**: DevEx surveys integrated

### Key Insights

1. **No single TypeScript library** provides complete DORA metrics calculation out of the box
2. **Apache DevLake** is the most comprehensive open-source solution but requires Docker/Grafana infrastructure
3. **Middleware** provides the closest to our needs but is a full platform, not a library
4. **Custom implementation** offers the most flexibility for project/feature-level filtering

## Implementation Approach

Based on the research, we implemented a custom TypeScript/Bun solution that:

1. **Fetches data directly from GitHub API** (PRs, deployments, workflows, issues)
2. **Supports Jira integration** for incident tracking (with mock support for testing)
3. **Calculates all four DORA metrics** with proper benchmarking
4. **Provides React dashboard components** for visualization
5. **Supports filtering** by project and feature labels

### Architecture

```
dora-metrics/
├── src/
│   ├── api/
│   │   ├── github.ts       # GitHub API client (PRs, deployments, workflows)
│   │   └── jira.ts         # Jira API client (issues, incidents)
│   ├── metrics/
│   │   └── calculator.ts   # DORA metrics calculation engine
│   ├── dashboard/
│   │   ├── Dashboard.tsx   # Main dashboard component
│   │   └── components/     # MetricCard, Charts, Filters, etc.
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── tests/
│   ├── unit/               # Unit tests for calculations
│   └── integration/        # E2E tests with real GitHub data
└── public/
    └── index.html          # Dashboard entry point
```

### DORA Metrics Calculation

| Metric | Data Source | Calculation |
|--------|-------------|-------------|
| Deployment Frequency | GitHub Deployments/Workflows | Successful prod deployments / time period |
| Lead Time for Changes | GitHub PRs | Median time from PR creation to merge |
| Change Failure Rate | GitHub Deployments + Jira Incidents | Failed deployments / total deployments |
| Recovery Time | Jira Incidents | Median incident resolution time |

### Performance Levels (DORA Benchmarks)

| Level | Deploy Freq | Lead Time | Failure Rate | Recovery Time |
|-------|-------------|-----------|--------------|---------------|
| Elite | Multiple/day | < 1 day | < 5% | < 1 hour |
| High | Daily-weekly | 1d-1w | 5-10% | < 1 day |
| Medium | Weekly-monthly | 1w-1m | 10-15% | < 1 week |
| Low | < Monthly | > 1 month | > 15% | > 1 week |

## Integration Test Results

Successfully tested against `facebook/react` repository:

```
=== DORA Metrics for facebook/react (last 7 days) ===
Pull Requests Analyzed: 20
Deployments (from workflows): 9
Incidents: 0

Metrics:
  Deployment Frequency: 1.14 per day (elite)
  Lead Time: 88 hours median (high)
  Change Failure Rate: 11.11% (medium)
  Recovery Time: 0 hours median (elite)

Overall Performance: MEDIUM
```

## Dashboard Visual Design

### Implemented Components

1. **MetricCard**: Individual metric display with value, level badge, and trend indicator
2. **OverallScore**: Overall performance level with progress bar
3. **MetricsChart**: Time series charts for deployment and lead time trends
4. **LeadTimeBreakdown**: Stacked bar visualization of coding/review/deploy phases
5. **BenchmarkTable**: DORA benchmark comparison table
6. **FilterPanel**: Repository, feature, and time period filters

### Design Recommendations

1. **Color Coding**: Elite (green), High (blue), Medium (amber), Low (red)
2. **Trend Indicators**: Up/down/stable arrows for quick status
3. **Responsive Layout**: Cards stack on mobile, charts resize
4. **Accessibility**: Sufficient contrast, ARIA labels, keyboard navigation

## Usage

### Running Tests
```bash
cd dora-metrics
bun test           # All tests
bun test:unit      # Unit tests only
bun test:integration # Integration tests (requires internet)
```

### Type Checking
```bash
bun run typecheck
```

### Development Server
```bash
bun run dev
# Open http://localhost:3000?repo=owner/repo
```

## Future Improvements

1. **Add GitHub Actions workflow** for automated data collection
2. **Implement webhook receivers** for real-time updates
3. **Add Jira Cloud API integration** with OAuth
4. **Create deployment tracking** via GitHub Deployments API
5. **Add team/developer filtering** (use with caution - DORA recommends against individual metrics)
6. **Implement data persistence** for historical trend analysis

## References

- [DORA State of DevOps Report 2024](https://dora.dev/)
- [Apache DevLake Documentation](https://devlake.apache.org/docs/)
- [GitHub Deployments API](https://docs.github.com/en/rest/deployments)
- [Jira REST API](https://developer.atlassian.com/server/jira/platform/rest-apis/)
