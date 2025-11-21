# Comprehensive Research Report: Jira-GitHub Integration Dashboard

**Date:** 2025-11-21
**Purpose:** Technology stack research for building a Jira-GitHub integration dashboard with lifecycle visualization

---

## 1. Jira Integration Libraries

### 1.1 jira.js (RECOMMENDED)
**Package:** `jira.js`
**Installation:** `npm install jira.js`
**GitHub:** https://github.com/MrRefactoring/jira.js
**Documentation:** https://mrrefactoring.github.io/jira.js/

**Capabilities:**
- Comprehensive JavaScript/TypeScript wrapper for Jira Cloud, Service Desk, and Agile REST APIs
- Covers nearly 100% of Jira APIs
- Full TypeScript support with type definitions
- Modern ESM support
- Active maintenance (last published: daily updates as of Nov 2025)
- 51+ projects using it in npm registry

**Authentication Methods:**
- Basic auth with API tokens
- OAuth 2.0 (3LO)
- Personal access tokens

**Pagination Support:**
- Built-in support for `startAt` and `maxResults` parameters
- Handles automatic pagination for large result sets
- Default maxResults limit: 50 records per request
- Can optimize with field selection to increase limit up to 5000

**Why Suitable:**
- Most actively maintained Jira library for Node.js
- Excellent TypeScript support
- Comprehensive API coverage
- Modern architecture (requires Node.js 20.0.0+)

**Limitations:**
- Requires Node.js 20.0.0 or newer
- Primarily focused on Jira Cloud (limited Server/Data Center support)

**Example Usage:**
```typescript
import { Version3Client } from 'jira.js';

const client = new Version3Client({
  host: 'https://your-domain.atlassian.net',
  authentication: {
    basic: {
      email: 'email@example.com',
      apiToken: 'your-api-token',
    },
  },
});

// Get issues with pagination
async function getAllIssues(jql: string) {
  let startAt = 0;
  const maxResults = 50;
  let allIssues = [];

  do {
    const response = await client.issueSearch.searchForIssuesUsingJql({
      jql,
      startAt,
      maxResults,
    });

    allIssues = allIssues.concat(response.issues);
    startAt += maxResults;

    if (startAt >= response.total) break;
  } while (true);

  return allIssues;
}
```

---

### 1.2 jira-client (Alternative)
**Package:** `jira-client`
**Installation:** `npm install jira-client`
**Documentation:** https://jira-node.github.io/

**Capabilities:**
- Object-oriented wrapper for Jira REST API
- Supports both Jira Cloud and Server
- Promise-based API

**Why Suitable:**
- Well-documented
- Good for legacy projects

**Limitations:**
- Less active maintenance compared to jira.js
- TypeScript support through @types/jira-client
- Smaller feature set

---

### 1.3 jira-connector (Not Recommended)
**Package:** `jira-connector`
**Status:** NO LONGER SUPPORTED
**Note:** Author recommends using jira.js instead

---

## 2. GitHub Integration Libraries

### 2.1 Octokit (RECOMMENDED)
**Package:** `octokit` (all-inclusive) or `@octokit/rest` (REST only)
**Installation:**
```bash
npm install octokit
# OR for REST API only
npm install @octokit/rest
```
**GitHub:** https://github.com/octokit/octokit.js
**Documentation:** Official GitHub SDK

**Capabilities:**
- All-batteries-included GitHub SDK
- REST API client with full endpoint coverage
- GraphQL API support
- Comprehensive TypeScript definitions
- Works in browsers, Node.js, and Deno
- Active maintenance (updates as of Nov 2025)

**Key Features for Your Project:**
- **Commits:** `repos.listCommits()` - Get commit history with author, date, message
- **Pull Requests:** `pulls.list()`, `pulls.get()` - PR details, status, reviews
- **Branches:** `repos.listBranches()`, `repos.getBranch()` - Branch information
- **Releases:** `repos.listReleases()`, `repos.getRelease()` - Release data
- **Pagination:** Built-in automatic pagination with `paginate()`

**Authentication Methods:**
- Personal access tokens
- OAuth tokens
- GitHub App installation tokens
- JWT for GitHub App authentication

**TypeScript Configuration Required:**
```json
{
  "compilerOptions": {
    "moduleResolution": "node16",
    "module": "node16"
  }
}
```

**Why Suitable:**
- Official GitHub SDK
- Excellent TypeScript support
- Comprehensive API coverage
- Active development and support
- Built-in pagination handling

**Example Usage:**
```typescript
import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: 'your-personal-access-token'
});

// Get commits
const commits = await octokit.repos.listCommits({
  owner: 'apache',
  repo: 'kafka',
  per_page: 100,
});

// Get pull requests
const prs = await octokit.pulls.list({
  owner: 'apache',
  repo: 'kafka',
  state: 'all',
  per_page: 100,
});

// Use pagination for large datasets
const allCommits = await octokit.paginate(octokit.repos.listCommits, {
  owner: 'apache',
  repo: 'kafka',
});
```

---

### 2.2 Alternative Packages

**@octokit/core** - Minimalistic, extendable with plugins
**@octokit/rest** - REST API client only
**@octokit/types** - TypeScript type definitions only

---

## 3. Data Correlation & Matching

### 3.1 Jira Ticket ID Parsing

#### jira-prepare-commit-msg
**Package:** `jira-prepare-commit-msg`
**Installation:** `npm install jira-prepare-commit-msg`
**Type:** TypeScript

**Capabilities:**
- Extracts Jira ticket IDs from Git branch names
- Adds ticket IDs to commit messages
- Supports custom regex patterns
- Default pattern: `([A-Z]+-\\d+)`

**Why Suitable:**
- Purpose-built for Jira-Git integration
- TypeScript support
- Customizable patterns
- Handles conventional commits

**Example Usage:**
```typescript
// Default regex patterns for Jira IDs
const basicPattern = /\b[A-Z][A-Z0-9_]+-[0-9]+/g;
const simplePattern = /[A-Z]+-[0-9]+/g;

// Extract Jira IDs from commit message
function extractJiraIds(commitMessage: string): string[] {
  const matches = commitMessage.match(/[A-Z]+-[0-9]+/g);
  return matches || [];
}

// Example commit messages
const examples = [
  "KAFKA-16998: Fix warnings in Github actions",
  "[REACT-1234] Add new component",
  "feat(PROJ-456): Implement feature"
];
```

---

### 3.2 Text Parsing Libraries

**Built-in JavaScript Regex** - No package needed, use native RegExp

**Example Patterns:**
```typescript
// Jira ticket patterns
const patterns = {
  basic: /\b[A-Z][A-Z0-9_]+-[0-9]+/g,
  withLookbehind: /(?<=^|[^\w-])[A-Z]+-\d+/g,
  conventional: /^([A-Z]+-[0-9]+).*$/
};

// Match Jira ID anywhere in text
function findJiraTickets(text: string): string[] {
  return text.match(/\b[A-Z]{2,}-\d+\b/g) || [];
}
```

---

### 3.3 Data Transformation Libraries

#### Remeda (RECOMMENDED for TypeScript)
**Package:** `remeda`
**Installation:** `npm install remeda`
**Website:** https://remedajs.com/

**Capabilities:**
- Written entirely in TypeScript
- Functional programming utilities
- Immutable data operations
- Tree-shakeable
- Data-first and data-last APIs

**Why Suitable:**
- Native TypeScript (not JS with types added later)
- Better type inference than Lodash/Ramda
- Modern API design
- Excellent for data transformation pipelines

**Example Usage:**
```typescript
import * as R from 'remeda';

// Transform Jira and GitHub data
const correlateData = R.pipe(
  R.map((commit) => ({
    ...commit,
    jiraIds: extractJiraIds(commit.message)
  })),
  R.filter((commit) => commit.jiraIds.length > 0),
  R.groupBy((commit) => commit.jiraIds[0])
);
```

---

#### Lodash (Traditional Alternative)
**Package:** `lodash`
**Installation:** `npm install lodash @types/lodash`

**Capabilities:**
- Comprehensive utility library
- Performance-focused
- Large ecosystem
- Well-tested

**Limitations:**
- JavaScript-first (types added later)
- Larger bundle size
- Less functional programming oriented

---

#### ts-belt (Modern Alternative)
**Package:** `@mobily/ts-belt`
**Installation:** `npm install @mobily/ts-belt`

**Capabilities:**
- Fast, modern TypeScript utilities
- Data-first approach
- Immutable by default
- Good TypeScript support

---

## 4. Dashboard & Visualization

### 4.1 Dashboard Frameworks

#### TailAdmin V2 (RECOMMENDED for Free/Open Source)
**Type:** Next.js + Tailwind CSS Admin Dashboard
**Cost:** Free and open-source
**Features:**
- 400+ UI elements
- Support for Next.js 15
- React 19 compatible
- Modern, responsive design
- TypeScript support

**Why Suitable:**
- Free and open source
- Modern tech stack
- Comprehensive component library
- Active development

---

#### Horizon UI Next.js
**Type:** Chakra UI + Next.js Dashboard
**Features:**
- Built with Chakra UI
- Next.js 15 support
- Modern component architecture
- Responsive design

---

### 4.2 Timeline Visualization Libraries

#### vis-timeline (RECOMMENDED)
**Package:** `vis-timeline`
**Installation:** `npm install vis-timeline`
**Documentation:** https://visjs.github.io/vis-timeline/docs/timeline/
**Weekly Downloads:** 124,401+

**Capabilities:**
- Interactive chronological visualization
- Drag and zoom functionality
- Create, edit, and delete items
- Automatic time scale adjustment (milliseconds to years)
- Single dates or date ranges
- Custom styling
- Groups and nested items

**React Wrappers:**
- `react-vis-timeline` - Performance-optimized
- `react-visjs-timeline` - Alternative wrapper

**Why Suitable:**
- Highly interactive
- Excellent for project lifecycle visualization
- Mature and stable
- Large user base
- Flexible styling

**Example Usage:**
```typescript
import { Timeline } from 'vis-timeline/standalone';

const container = document.getElementById('timeline');
const items = [
  {
    id: 1,
    content: 'KAFKA-16998',
    start: '2025-01-15',
    end: '2025-02-20',
    type: 'range'
  },
  {
    id: 2,
    content: 'Released v1.0',
    start: '2025-02-20',
    type: 'point'
  }
];

const timeline = new Timeline(container, items, {
  stack: true,
  orientation: 'top',
  editable: false,
});
```

---

#### react-chrono
**Package:** `react-chrono`
**Installation:** `npm install react-chrono`

**Capabilities:**
- Three formats: horizontal, vertical, vertical-alternating
- Images, videos, icons support
- Custom items
- React-native component

**Why Suitable:**
- React-specific
- Beautiful default styling
- Easy to use
- Good for storytelling

---

### 4.3 Chart Libraries

#### Recharts (RECOMMENDED)
**Package:** `recharts`
**Installation:** `npm install recharts`
**Version:** 3.0+ (major update in 2025)

**Capabilities:**
- Built on D3.js and React
- Declarative API
- 24.8K+ GitHub stars
- Composable chart components
- Responsive design
- SVG rendering

**New in v3.0 (2025):**
- Enhanced accessibility
- Better animations
- Improved TypeScript support

**Why Suitable:**
- Excellent for React projects
- Easy to use
- Good balance of simplicity and customization
- Active development
- Strong TypeScript support

**Chart Types:**
- Line, Bar, Area, Pie, Scatter
- Composed charts
- Custom shapes

**Example Usage:**
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const data = [
  { date: '2025-01', tickets: 12, commits: 45 },
  { date: '2025-02', tickets: 15, commits: 52 },
];

<LineChart width={600} height={300} data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="tickets" stroke="#8884d8" />
  <Line type="monotone" dataKey="commits" stroke="#82ca9d" />
</LineChart>
```

---

#### Chart.js (Alternative)
**Package:** `chart.js` + `react-chartjs-2`
**Installation:** `npm install chart.js react-chartjs-2`

**Capabilities:**
- Simple and easy to use
- Great documentation
- Responsive and animated
- Canvas-based rendering

**Why Suitable:**
- Beginner-friendly
- Standard chart types
- Good performance
- Large community

**When to Choose:**
- Need simple, quick charts
- Standard visualizations only
- Performance is critical
- Canvas rendering preferred

---

#### D3.js (Advanced Alternative)
**Package:** `d3`
**Installation:** `npm install d3 @types/d3`

**Capabilities:**
- Maximum flexibility and control
- Any type of visualization possible
- Powerful data manipulation

**Limitations:**
- Steep learning curve
- More code required
- TypeScript definitions "not great"
- More complex integration with React

**When to Choose:**
- Need custom, unique visualizations
- Complex data-driven documents
- Have D3.js expertise
- Maximum control required

---

#### Nivo (Modern Alternative)
**Features:**
- Built on D3.js
- React-specific
- Multiple rendering methods
- Great for complex visualizations

---

#### Victory (Alternative)
**Features:**
- Formidable Labs project
- 11K+ GitHub stars
- Active development in 2025
- React Native support

---

## 5. Public Test Data Sources

### 5.1 Apache Jira Projects (RECOMMENDED)

#### Apache Software Foundation JIRA
**URL:** https://issues.apache.org/jira/
**Project Browser:** https://issues.apache.org/jira/projects/

**Access:**
- Public viewing available
- Account required for full access (self-serve signup available)
- No authentication needed for read-only API access to public projects

**Major Projects Available:**
- **Apache Kafka** (KAFKA) - https://issues.apache.org/jira/projects/KAFKA
- Apache Hadoop
- Apache Struts
- Apache Tapestry
- Apache Geronimo
- Apache Camel
- Apache Flink
- Apache Spark

**Why Suitable:**
- Real-world production data
- Large-scale projects
- Good commit message discipline
- Clear Jira-GitHub correlation
- Well-maintained issue tracking

**Example Jira Issues:**
- KAFKA-16998: Fix warnings in Github actions
- KAFKA-19715: Consider bumping 3rd party Github Actions

---

### 5.2 GitHub Repositories with Good Jira Integration

#### Apache Kafka
**Jira:** https://issues.apache.org/jira/projects/KAFKA
**GitHub:** https://github.com/apache/kafka

**Characteristics:**
- Jira issue IDs in commit messages
- Format: "KAFKA-XXXXX: Description"
- Active development
- Large commit history
- Clear lifecycle tracking

**Example Commits:**
```
KAFKA-16998: Fix warnings in Github actions
KAFKA-19715: Consider bumping 3rd party Github Actions
```

---

#### WildFly Project
**Uses both Jira and GitHub**

---

### 5.3 Other Public Jira Instances

#### Spring Framework (Migrated)
**Note:** Spring Framework migrated from Jira to GitHub Issues in 2019
**Historical Context:** Good case study on Jira-GitHub integration challenges

**Previous Setup:**
- Required Jira issue for every PR
- Single place of record
- Eventually moved to GitHub Issues only

---

#### Codehaus (Historical)
**URL:** http://jira.codehaus.org/
**Note:** May be archived

---

### 5.4 Demo/Example Projects

#### For Testing Without Real Data

**Option 1: Create Test Jira Cloud Instance**
- Free tier available at Atlassian
- Can create sample data
- Full API access

**Option 2: Mock Data**
- Create sample JSON files mimicking Jira/GitHub APIs
- Useful for development
- No rate limits

**Option 3: Open Source Demo Apps**
- Jira Clone projects on GitHub
- Example: https://github.com/oldboyxx/jira_clone
- Built with React/TypeScript

---

## 6. Testing & Quality Tools

### 6.1 Testing Frameworks

#### Vitest (RECOMMENDED for New Projects)
**Package:** `vitest`
**Installation:** `npm install -D vitest`
**Documentation:** https://vitest.dev/

**Capabilities:**
- Built on Vite and esbuild
- 10-20x faster than Jest in watch mode
- Native ESM and TypeScript support
- No configuration needed for TypeScript
- Jest-compatible API (95% compatible)
- 1.5M weekly downloads

**Recent Updates:**
- Vitest 3 released January 2025
- New features and improvements
- Breaking changes documented

**Why Suitable:**
- Modern architecture (created 2021)
- Excellent TypeScript support out of the box
- Faster execution
- Perfect for Vite-based projects
- ESM-first approach

**Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**Example Test:**
```typescript
import { describe, it, expect } from 'vitest';
import { extractJiraIds } from './jira-parser';

describe('Jira ID Extraction', () => {
  it('should extract Jira IDs from commit messages', () => {
    const message = 'KAFKA-16998: Fix warnings';
    const ids = extractJiraIds(message);
    expect(ids).toEqual(['KAFKA-16998']);
  });
});
```

---

#### Jest (Alternative for Legacy Projects)
**Package:** `jest` + `ts-jest` + `@types/jest`
**Installation:** `npm install -D jest ts-jest @types/jest`

**Capabilities:**
- Very stable and battle-tested
- 3M weekly downloads
- Massive ecosystem
- Created by Meta (Facebook) in 2011

**Why Still Viable:**
- Mature and stable
- Large community
- More resources available
- Better for React Native
- Legacy system compatibility

**Limitations:**
- Slower than Vitest
- More configuration needed for TypeScript
- Not ESM-first
- Requires Babel/SWC/ts-jest

**When to Choose:**
- Existing Jest projects
- React Native apps
- Need maximum ecosystem support
- Large/older codebases

---

### 6.2 Linting Tools

#### ESLint with TypeScript (ESSENTIAL)
**Packages:** `eslint` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
**Installation:**
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Capabilities:**
- Syntax checking
- Code quality enforcement
- TypeScript-specific rules
- Auto-fixing
- Custom rules

**Configuration:**
```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
```

---

#### Prettier (Code Formatting)
**Package:** `prettier`
**Installation:** `npm install -D prettier eslint-config-prettier`

**Why Suitable:**
- Automatic code formatting
- Works with ESLint
- Consistent style
- Reduces bikeshedding

**Configuration:**
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

### 6.3 Pre-commit Hook Tools

#### Husky (RECOMMENDED)
**Package:** `husky`
**Installation:** `npm install -D husky`
**Setup:** `npx husky init`

**Capabilities:**
- Git hooks management
- Pre-commit, pre-push hooks
- Runs linters and tests
- Modern, simple API

**Why Suitable:**
- Industry standard
- Easy setup
- Works with lint-staged
- Active development

**Setup:**
```bash
npm install -D husky
npx husky init
echo "npm test" > .husky/pre-commit
```

---

#### lint-staged (ESSENTIAL with Husky)
**Package:** `lint-staged`
**Installation:** `npm install -D lint-staged`
**GitHub:** https://github.com/lint-staged/lint-staged

**Capabilities:**
- Runs tasks on staged Git files only
- Fast (only checks changed files)
- Auto-fix support
- Works with any linter/formatter

**Why Suitable:**
- Performance optimization
- Only checks relevant files
- Automatic fixing
- Integrates with Husky

**Configuration:**
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --cache --fix",
      "prettier --write"
    ],
    "*.{js,jsx}": [
      "eslint --cache --fix",
      "prettier --write"
    ],
    "*.{css,md,json}": [
      "prettier --write"
    ]
  }
}
```

**Husky Integration:**
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

---

#### TypeScript Type Checking in Pre-commit
**Add to lint-staged:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "tsc --noEmit",
      "eslint --cache --fix",
      "prettier --write"
    ]
  }
}
```

**Why Important:**
- Catches type errors before commit
- ESLint catches syntax, tsc catches types
- Prevents broken code from entering repository

---

## 7. Recommended Tech Stack Summary

### Core Integration Layer
- **Jira Client:** `jira.js` - Modern, comprehensive, active
- **GitHub Client:** `octokit` - Official, complete, well-maintained
- **Data Transformation:** `remeda` - TypeScript-native, functional

### Frontend Dashboard
- **Framework:** Next.js 15 + React 19
- **UI Library:** TailAdmin V2 (free) or Chakra UI
- **Styling:** Tailwind CSS
- **Timeline:** `vis-timeline` with `react-vis-timeline`
- **Charts:** `recharts` 3.0+

### Testing & Quality
- **Test Framework:** `vitest` (new projects) or `jest` (legacy)
- **Linting:** `eslint` + `@typescript-eslint/*`
- **Formatting:** `prettier`
- **Pre-commit:** `husky` + `lint-staged`

### Development Tools
- **TypeScript:** 5.x
- **Node.js:** 20.x LTS
- **Package Manager:** npm or pnpm

---

## 8. Installation Quick Start

```bash
# Initialize project
npm init -y
npm install typescript @types/node -D
npx tsc --init

# Core dependencies
npm install jira.js octokit remeda

# React/Next.js
npm install next react react-dom
npm install -D @types/react @types/react-dom

# Visualization
npm install recharts vis-timeline react-vis-timeline

# Testing
npm install -D vitest @vitest/ui
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier

# Git hooks
npm install -D husky lint-staged
npx husky init
```

---

## 9. Example Project Structure

```
project-root/
├── src/
│   ├── api/
│   │   ├── jira-client.ts       # Jira API wrapper
│   │   ├── github-client.ts      # GitHub API wrapper
│   │   └── correlator.ts         # Data correlation logic
│   ├── components/
│   │   ├── Timeline.tsx          # vis-timeline wrapper
│   │   ├── Charts.tsx            # Recharts components
│   │   └── Dashboard.tsx         # Main dashboard
│   ├── utils/
│   │   ├── jira-parser.ts        # Jira ID extraction
│   │   └── data-transform.ts     # Data transformation
│   └── types/
│       ├── jira.ts               # Jira type definitions
│       └── github.ts             # GitHub type definitions
├── tests/
│   ├── api/
│   └── utils/
├── .husky/
│   └── pre-commit
├── .eslintrc.js
├── .prettierrc
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Public Test Data Recommendations

### Best Options for Development:

1. **Apache Kafka (RECOMMENDED)**
   - Jira: https://issues.apache.org/jira/projects/KAFKA
   - GitHub: https://github.com/apache/kafka
   - Excellent correlation between platforms
   - Active development
   - Clear commit message format

2. **Create Free Atlassian Cloud Instance**
   - 10 users free tier
   - Full API access
   - Create sample data
   - No rate limit concerns

3. **Mock Data for Unit Tests**
   - Create fixtures in `tests/fixtures/`
   - JSON files mimicking API responses
   - Faster tests
   - No external dependencies

---

## 11. Key Considerations

### Authentication & Rate Limits
- **Jira:** Use API tokens, not passwords
- **GitHub:** Personal access token, 5000 requests/hour authenticated
- **Store credentials:** Use environment variables, never commit

### Performance
- **Pagination:** Always implement for large datasets
- **Caching:** Cache API responses when appropriate
- **Debouncing:** Limit API calls in interactive features

### TypeScript
- Enable strict mode in tsconfig.json
- Use proper typing for API responses
- Leverage type inference from libraries

### Data Privacy
- Don't commit API tokens or credentials
- Use .env files with .gitignore
- Consider data sensitivity in public repos

---

## 12. Additional Resources

### Documentation
- Jira API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- GitHub API: https://docs.github.com/en/rest
- Octokit: https://octokit.github.io/
- Recharts: https://recharts.org/
- Vitest: https://vitest.dev/

### Learning Resources
- Apache Kafka Jira examples: Real-world usage patterns
- Spring Framework migration story: Jira to GitHub Issues
- TypeScript handbook: https://www.typescriptlang.org/docs/

---

## Summary of Key Recommendations

| Category | Primary Choice | Alternative |
|----------|---------------|-------------|
| Jira API | jira.js | jira-client |
| GitHub API | octokit | @octokit/rest |
| Data Transform | remeda | lodash |
| Timeline | vis-timeline | react-chrono |
| Charts | recharts 3.0+ | Chart.js |
| Testing | vitest | jest |
| Linting | eslint + typescript-eslint | - |
| Pre-commit | husky + lint-staged | - |
| Test Data | Apache Kafka Jira/GitHub | Create own instance |

---

**Report End**

This research provides a comprehensive foundation for building a production-ready Jira-GitHub integration dashboard with lifecycle visualization capabilities.
