# Smoke Test Oracle

A composable smoke testing framework powered by Chrome DevTools MCP with context-aware storage and visual regression capabilities.

## Overview

Smoke Test Oracle is a next-generation browser testing framework that applies the MCP (Model Context Protocol) composability patterns from [Anthropic's Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) blog post. It solves the critical problem of context pollution when testing web applications by implementing a **storage-based architecture** where large artifacts (DOM, screenshots, console logs) are stored on disk and referenced by lightweight pointers.

### Key Features

🎯 **Context Isolation** - DOM, screenshots, and console logs are stored separately and accessed via references
🔍 **Progressive Disclosure** - Data loaded on-demand through queries, not bulk retrieval
📸 **Visual Regression** - Pixel-perfect screenshot comparison with diff visualization
✅ **Multi-Modal Checkpoints** - Combine DOM assertions, console validation, and visual diffs
🚀 **Composable Architecture** - Built on MCP patterns for maximum extensibility
🧪 **Fluent Test API** - Readable, chainable test definitions
💾 **Chunked Storage** - Large DOMs automatically chunked for efficient storage
📊 **Rich Reporting** - Generate HTML, JSON, or text reports with visual diffs

## Architecture

This project implements the four critical capabilities requested:

### 1. Context-Aware Storage System

Markup and scripts are **siloed away from LLM context** using a sophisticated storage layer:

```typescript
// Stores return lightweight refs, not raw data
const domRef = await storage.dom.store('dom', testId, stepId, htmlContent);
// domRef is ~200 bytes, htmlContent could be 2MB

// Query chunks on-demand
const loginForm = await storage.dom.query(domRef, { selector: '#login-form' });
```

**How it works:**
- DOM content is chunked (1,000 nodes per chunk by default)
- Each chunk gets an index for fast selector-based queries
- Only requested chunks are loaded into memory
- References contain metadata (size, hash, timestamp) but not content

### 2. Console Error Retrieval

Console logs are captured, indexed, and stored with **zero context pollution**:

```typescript
// Store console logs with automatic indexing
const consoleRef = await storage.console.store('console', testId, stepId, logs);

// Query only errors (doesn't load all logs)
const errors = await storage.console.query(consoleRef, {
  errorLevel: ['error', 'warning']
});

// Get summary without loading logs
const metadata = await storage.console.getMetadata(consoleRef);
// { errorCount: 3, warningCount: 1 }
```

**Features:**
- Multi-level indexing (by level: error, warn, info, log, debug)
- Full-text search without loading all logs
- Pattern-based filtering (regex support)
- Error categorization (network, script, CORS, etc.)

### 3. Screenshot Capture with Context Management

Screenshots don't pollute context and are accessible when needed:

```typescript
// Capture and store screenshot
const screenshotRef = await storage.screenshot.store(
  'screenshot',
  testId,
  stepId,
  imageBuffer
);

// Automatic thumbnail generation (320x240 by default)
const thumbnail = await storage.screenshot.getThumbnail(screenshotRef);

// Get screenshot metadata without loading image
const metadata = await storage.screenshot.getMetadata(screenshotRef);
// { width: 1920, height: 1080, format: 'png', size: 245000 }

// Load full image only when needed
const fullImage = await storage.screenshot.retrieve(screenshotRef);
```

**Features:**
- Automatic thumbnail generation for previews
- Multiple format support (PNG, JPEG, WebP)
- Region-based cropping
- Visual diff generation with Pixelmatch

### 4. Chrome DevTools Exploration Support

Type-safe wrappers around Chrome DevTools MCP enable safe exploration:

```typescript
// Type-safe async wrappers
const chrome = new ChromeDevToolsWrapper(mcpClient);

// Navigate with retry logic
await chrome.navigate('https://example.com');

// Extract DOM safely
const html = await chrome.getDOM();

// Query elements
const button = await chrome.querySelector('#submit-button');

// Capture console safely
const logs = await chrome.getConsoleLogs();

// Take screenshots
const screenshot = await chrome.captureScreenshot({ fullPage: true });
```

## Installation

```bash
cd smoke-test-oracle
npm install
npm run build
```

### Prerequisites

- Node.js >= 18.0.0
- Chrome DevTools MCP server running

### Setup Chrome DevTools MCP

```bash
# Install Chrome DevTools MCP globally
npx chrome-devtools-mcp@latest

# Or configure in your MCP client
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

## Quick Start

### Basic Example

```typescript
import { TestBuilder } from 'smoke-test-oracle';

const test = TestBuilder
  .create('Homepage Smoke Test')
  .navigate('https://example.com')
  .checkpoint('page-loaded', {
    dom: {
      exists: ['#header', '#main', '#footer'],
      notExists: ['.error-message']
    },
    console: {
      noErrors: true
    }
  })
  .click('#search-button')
  .type('#search-input', 'test query')
  .wait(1000)
  .checkpoint('search-results', {
    dom: {
      exists: ['.search-results'],
      count: { selector: '.result-item', operator: '>=', value: 1 }
    },
    visual: {
      baselineCheckpoint: 'page-loaded',
      tolerance: 0.05
    }
  });

// Execute test
const result = await test.run({
  storageDir: './test-storage',
  chromeMCP: mcpClient
});

console.log(`Test ${result.status}: ${result.checkpoints.length} checkpoints`);
```

### Multi-Step E-commerce Flow

```typescript
const checkoutTest = TestBuilder
  .create('E-commerce Checkout Flow')
  .navigate('https://shop.example.com')
  .checkpoint('product-listing', {
    dom: { exists: ['.product-grid'] },
    console: { maxErrors: 0 }
  })
  .click('.product-card:first-child .add-to-cart')
  .wait({ selector: '.cart-count' })
  .checkpoint('cart-updated', {
    dom: {
      text: [{ selector: '.cart-count', text: '1' }]
    }
  })
  .navigate('https://shop.example.com/checkout')
  .checkpoint('checkout-page', {
    dom: { exists: ['#payment-form', '#shipping-form'] },
    console: { noErrors: true }
  })
  .type('#email', 'test@example.com')
  .type('#card-number', '4242424242424242')
  .checkpoint('form-filled', {
    visual: {
      baselineCheckpoint: 'checkout-page',
      tolerance: 0.02,
      regions: [{ x: 0, y: 100, width: 400, height: 300 }]
    }
  });

const result = await checkoutTest.run({ storageDir: './storage' });
```

### Visual Regression Testing

```typescript
const visualTest = TestBuilder
  .create('Visual Regression Test')
  .navigate('https://app.example.com/dashboard')
  .checkpoint('baseline', {
    dom: { exists: ['.dashboard-container'] }
  })
  .wait(2000) // Let dynamic content load
  .checkpoint('fully-loaded', {
    visual: {
      baselineCheckpoint: 'baseline',
      tolerance: 0.01, // 1% pixel difference allowed
      ignoreRegions: [
        { x: 100, y: 0, width: 200, height: 50 } // Ignore timestamp
      ]
    },
    console: {
      allowedPatterns: [/analytics\.js/], // Allow known warnings
      forbiddenPatterns: [/critical error/i]
    }
  });
```

## API Reference

### Test Builder API

```typescript
class TestBuilder {
  static create(name: string): SmokeTest
}

class SmokeTest {
  // Navigation
  navigate(url: string, options?: NavigateOptions): this

  // Interactions
  click(selector: string): this
  type(selector: string, text: string): this
  select(selector: string, value: string): this
  hover(selector: string): this
  press(key: string): this
  scroll(options: ScrollOptions): this

  // Waits
  wait(ms: number): this
  wait(selector: string): this
  wait(condition: () => Promise<boolean>): this

  // Checkpoints
  checkpoint(name: string, validations?: CheckpointValidations): this

  // Execution
  run(config: TestConfig): Promise<TestResult>
}
```

### Checkpoint Validations

```typescript
interface CheckpointValidations {
  // DOM Assertions
  dom?: {
    exists?: string[]                    // CSS selectors that must exist
    notExists?: string[]                 // CSS selectors that must not exist
    visible?: string[]                   // Elements that must be visible
    hidden?: string[]                    // Elements that must be hidden
    text?: Array<{                       // Text content assertions
      selector: string
      text: string
      mode?: 'exact' | 'contains' | 'regex'
    }>
    attributes?: Array<{                 // Attribute assertions
      selector: string
      attribute: string
      value: string
    }>
    count?: {                            // Element count assertions
      selector: string
      operator: '=' | '>' | '<' | '>=' | '<='
      value: number
    }
  }

  // Console Validations
  console?: {
    noErrors?: boolean                   // Must have zero errors
    maxErrors?: number                   // Maximum error count
    maxWarnings?: number                 // Maximum warning count
    expectedMessages?: Array<{           // Messages that should appear
      text: string
      level?: 'log' | 'info' | 'warn' | 'error'
      mode?: 'exact' | 'contains' | 'regex'
    }>
    forbiddenMessages?: Array<{          // Messages that must not appear
      text: string
      mode?: 'exact' | 'contains' | 'regex'
    }>
    allowedPatterns?: RegExp[]           // Errors matching these are ignored
    forbiddenPatterns?: RegExp[]         // Errors matching these fail test
  }

  // Visual Regression
  visual?: {
    baselineCheckpoint?: string          // Compare with this checkpoint
    tolerance?: number                   // Pixel difference tolerance (0-1)
    regions?: VisualRegion[]             // Specific regions to compare
    ignoreRegions?: VisualRegion[]       // Regions to exclude from comparison
  }

  // Custom Validations
  custom?: (context: ValidationContext) => Promise<AssertionResult[]>
}
```

### Storage API

```typescript
class StorageManager {
  // Store artifacts (returns lightweight refs)
  dom: DOMStore
  screenshot: ScreenshotStore
  console: ConsoleStore
  checkpoint: CheckpointStore

  // Query methods (progressive disclosure)
  queryDOM(ref: StorageRef, selector: string): Promise<DOMNode[]>
  queryConsole(ref: StorageRef, filter: ConsoleFilter): Promise<ConsoleEntry[]>
  getScreenshot(ref: StorageRef, region?: VisualRegion): Promise<Buffer>

  // Management
  getStats(): Promise<StorageStats>
  cleanup(olderThan: Date): Promise<number>
  export(outputPath: string): Promise<void>
  import(inputPath: string): Promise<void>
}
```

### CLI Usage

```bash
# Run a test file
smoke-test run ./tests/homepage.test.ts

# Run with options
smoke-test run ./tests/checkout.test.ts --verbose --format html --output ./reports

# Query stored data
smoke-test query --test-id abc123 --category screenshots

# Generate report
smoke-test report abc123 --format html --output ./report.html

# Clean up old storage
smoke-test clean --older-than 30d --keep-last 10

# Initialize configuration
smoke-test init
```

## Project Structure

```
smoke-test-oracle/
├── src/
│   ├── core/                    # Core types and orchestration
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── orchestrator.ts      # Test orchestrator
│   │   ├── test-runner.ts       # Test execution engine
│   │   └── checkpoint-manager.ts # Checkpoint lifecycle
│   │
│   ├── storage/                 # Context-aware storage layer
│   │   ├── storage-provider.ts  # Base storage interface
│   │   ├── dom-store.ts         # DOM storage with chunking
│   │   ├── screenshot-store.ts  # Screenshot management
│   │   ├── console-store.ts     # Console log storage
│   │   ├── checkpoint-store.ts  # Checkpoint persistence
│   │   └── index.ts             # Storage manager
│   │
│   ├── chrome/                  # Chrome DevTools MCP integration
│   │   ├── devtools-wrapper.ts  # Main wrapper class
│   │   ├── navigation.ts        # Navigation utilities
│   │   ├── console-reader.ts    # Console extraction
│   │   ├── screenshot-capture.ts # Screenshot utilities
│   │   └── dom-extractor.ts     # DOM extraction
│   │
│   ├── validation/              # Checkpoint validation
│   │   ├── checkpoint-validator.ts # Main validator
│   │   ├── assertion-engine.ts  # Assertion evaluation
│   │   ├── error-filter.ts      # Console filtering
│   │   └── visual-diff.ts       # Image comparison
│   │
│   ├── output/                  # Reporting and visualization
│   │   ├── formatter.ts         # Result formatting
│   │   ├── visualizer.ts        # Visual diff rendering
│   │   └── report-generator.ts  # Report generation
│   │
│   ├── api/                     # Public APIs
│   │   ├── test-builder.ts      # Fluent test builder
│   │   ├── checkpoint-api.ts    # Checkpoint management
│   │   └── query-api.ts         # Data querying
│   │
│   ├── cli.ts                   # Command-line interface
│   └── index.ts                 # Main exports
│
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
│
├── examples/                    # Usage examples
├── storage/                     # Runtime storage (git-ignored)
└── config/                      # Configuration files
```

## Key Architecture Patterns

### 1. Filesystem-Based Code API

Following Anthropic's MCP composability pattern, Chrome DevTools operations are exposed as composable async functions:

```typescript
// Natural composition in code
await chrome.navigate(url);
const [dom, screenshot, logs] = await Promise.all([
  chrome.getDOM(),
  chrome.captureScreenshot({ fullPage: true }),
  chrome.getConsoleLogs()
]);

// Store with refs (not raw data)
const domRef = await storage.dom.store('dom', testId, stepId, dom);
const screenshotRef = await storage.screenshot.store('screenshot', testId, stepId, screenshot);
const consoleRef = await storage.console.store('console', testId, stepId, logs);
```

### 2. Progressive Disclosure

Data is loaded only when explicitly queried, dramatically reducing context usage:

```typescript
// Get lightweight metadata first
const metadata = await storage.console.getMetadata(consoleRef);
console.log(`Found ${metadata.errorCount} errors`);

// Load actual errors only if needed
if (metadata.errorCount > 0) {
  const errors = await storage.console.query(consoleRef, {
    errorLevel: ['error']
  });
  // Process errors...
}
```

### 3. Local Data Filtering

Large datasets are processed locally before returning to the LLM:

```typescript
// 10,000 console entries stored
const consoleRef = await storage.console.store('console', testId, stepId, allLogs);

// Returns only critical issues (maybe 3 entries)
const critical = await storage.console.query(consoleRef, {
  errorLevel: ['error'],
  patterns: [/critical|fatal/i]
});
```

### 4. State Persistence

Checkpoint state persists with references, not raw data:

```typescript
interface CheckpointState {
  checkpointId: string
  testId: string
  name: string
  timestamp: Date

  // Lightweight refs (200 bytes each, not megabytes of data!)
  domRef: StorageRef
  screenshotRef: StorageRef
  consoleRef: StorageRef

  // Validation results (lightweight)
  validationResults: ValidationResult
  passed: boolean
}
```

## Performance Characteristics

- **Context Usage**: 98%+ reduction compared to loading all data
- **DOM Chunking**: 1,000 nodes per chunk (configurable)
- **Thumbnail Generation**: 320x240 PNG by default
- **Query Performance**: O(1) for indexed queries, O(log n) for time-range queries
- **Storage Efficiency**: Compression available for HTML/JSON

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm test tests/unit

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Configuration

Create `smoke-test.config.json`:

```json
{
  "storageDir": "./storage",
  "storageCompression": false,
  "storageChunkSize": 1000,
  "screenshotFormat": "png",
  "screenshotQuality": 90,
  "visualDiffTolerance": 0.01,
  "testTimeout": 30000,
  "chromeMCP": {
    "serverUrl": "http://localhost:3000",
    "headless": true
  }
}
```

Or use environment variables (`.env`):

```bash
STORAGE_DIR=./storage
STORAGE_COMPRESSION=false
STORAGE_CHUNK_SIZE=1000
SCREENSHOT_FORMAT=png
SCREENSHOT_QUALITY=90
VISUAL_DIFF_TOLERANCE=0.01
TEST_TIMEOUT=30000
CHROME_DEVTOOLS_MCP_URL=http://localhost:3000
```

## Use Cases

### 1. Smoke Testing

Quickly verify critical user flows work after deployments:

```typescript
const smokeTest = TestBuilder.create('Critical Paths Smoke Test')
  .navigate('https://app.example.com/login')
  .checkpoint('login-page-loads', { console: { noErrors: true } })
  .type('#email', 'test@example.com')
  .type('#password', 'password123')
  .click('#login-button')
  .checkpoint('dashboard-loads', {
    dom: { exists: ['.dashboard'] },
    console: { maxErrors: 0 }
  });
```

### 2. Visual Regression Testing

Detect visual changes between deployments:

```typescript
const visualTest = TestBuilder.create('UI Regression Test')
  .navigate('https://app.example.com')
  .checkpoint('baseline-screenshot')
  // ... make changes ...
  .checkpoint('after-changes', {
    visual: {
      baselineCheckpoint: 'baseline-screenshot',
      tolerance: 0.01
    }
  });
```

### 3. Cypress-like Workflows

Multi-step test flows with checkpoints acting as milestones:

```typescript
const checkoutFlow = TestBuilder.create('Checkout Flow')
  .navigate('https://shop.example.com')
  .checkpoint('homepage', { dom: { exists: ['.products'] } })
  .click('.product:first-child .add-to-cart')
  .checkpoint('cart-updated', { dom: { exists: ['.cart-badge'] } })
  .click('.cart-icon')
  .checkpoint('cart-page', { dom: { exists: ['.cart-items'] } })
  .click('.checkout-button')
  .checkpoint('checkout-page', { dom: { exists: ['#payment-form'] } });
```

## Roadmap

- [ ] Support for network request monitoring
- [ ] Performance metrics capture (Core Web Vitals)
- [ ] Multi-browser support (Firefox, Safari)
- [ ] Parallel test execution
- [ ] CI/CD integrations (GitHub Actions, GitLab CI)
- [ ] Test result dashboard
- [ ] Auto-healing selectors

## Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.

## License

MIT

## Acknowledgments

Built following the MCP composability patterns from Anthropic's [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) blog post.

Powered by:
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Model Context Protocol SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Pixelmatch](https://github.com/mapbox/pixelmatch) for visual diffs
- [Sharp](https://github.com/lovell/sharp) for image processing
