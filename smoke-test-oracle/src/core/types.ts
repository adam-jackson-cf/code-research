/**
 * Core TypeScript types and interfaces for the smoke-test-oracle project.
 *
 * This file defines all the fundamental types used throughout the testing framework,
 * including storage management, test definitions, checkpoints, validations, and
 * Chrome DevTools integrations.
 */

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Categories for organizing stored test artifacts.
 * Each category represents a different type of test data that can be stored and retrieved.
 */
export enum StorageCategory {
  /** Screenshot images captured during test execution */
  SCREENSHOT = 'screenshot',
  /** HTML snapshots of the DOM at specific points in time */
  HTML = 'html',
  /** Console logs and messages from the browser */
  CONSOLE_LOG = 'console_log',
  /** Network request and response data */
  NETWORK_LOG = 'network_log',
  /** Performance metrics and timing data */
  PERFORMANCE = 'performance',
  /** Visual comparison diff results */
  VISUAL_DIFF = 'visual_diff',
  /** Test execution metadata and results */
  METADATA = 'metadata',
}

/**
 * Reference to a stored artifact.
 * Contains metadata about the stored item without including the actual data.
 * This enables efficient querying and reference tracking without loading large payloads.
 */
export interface StorageRef {
  /** The category/type of the stored artifact */
  category: StorageCategory;

  /** Unique identifier for the test that generated this artifact */
  testId: string;

  /** Optional step identifier within the test */
  stepId?: string;

  /** Storage path or key where the artifact is located */
  path: string;

  /** Size of the stored artifact in bytes */
  size: number;

  /** Content hash for integrity verification (e.g., SHA-256) */
  hash: string;

  /** Timestamp when the artifact was stored (ISO 8601 format) */
  timestamp: string;

  /** Whether the artifact is stored in compressed format */
  compressed: boolean;

  /** Optional custom metadata tags for filtering and organization */
  tags?: Record<string, string>;
}

/**
 * Extended metadata for a stored artifact.
 * Includes the storage reference plus additional contextual information.
 */
export interface StorageMetadata extends StorageRef {
  /** MIME type of the stored content */
  contentType: string;

  /** Encoding used for the stored content (e.g., 'utf-8', 'base64') */
  encoding: string;

  /** Optional description of the artifact */
  description?: string;

  /** Test run identifier for grouping related artifacts */
  runId?: string;
}

/**
 * Filter criteria for querying stored artifacts.
 */
export interface QueryFilter {
  /** Filter by storage category */
  category?: StorageCategory;

  /** Filter by test ID */
  testId?: string;

  /** Filter by step ID */
  stepId?: string;

  /** Filter by test run ID */
  runId?: string;

  /** Filter by custom tags */
  tags?: Record<string, string>;

  /** Filter by timestamp range */
  timestampRange?: {
    start: string;
    end: string;
  };

  /** Maximum number of results to return */
  limit?: number;

  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Storage provider interface for managing test artifacts.
 * Implementations can use different backends (filesystem, S3, database, etc.)
 */
export interface StorageProvider {
  /**
   * Store an artifact and return a reference to it.
   *
   * @param category - The type of artifact being stored
   * @param content - The content to store (Buffer or string)
   * @param metadata - Additional metadata about the artifact
   * @returns Promise resolving to a storage reference
   */
  store(
    category: StorageCategory,
    content: Buffer | string,
    metadata: Partial<StorageMetadata>
  ): Promise<StorageRef>;

  /**
   * Retrieve an artifact's content using its reference.
   *
   * @param ref - Storage reference to retrieve
   * @returns Promise resolving to the artifact content
   */
  retrieve(ref: StorageRef): Promise<Buffer | string>;

  /**
   * Query stored artifacts using filter criteria.
   *
   * @param filter - Filter criteria for the query
   * @returns Promise resolving to array of matching storage references
   */
  query(filter: QueryFilter): Promise<StorageRef[]>;

  /**
   * Delete an artifact from storage.
   *
   * @param ref - Storage reference to delete
   * @returns Promise resolving when deletion is complete
   */
  delete(ref: StorageRef): Promise<void>;

  /**
   * Get extended metadata for a stored artifact.
   *
   * @param ref - Storage reference to query
   * @returns Promise resolving to full storage metadata
   */
  getMetadata(ref: StorageRef): Promise<StorageMetadata>;

  /**
   * List all storage references for a specific test.
   *
   * @param testId - Test identifier
   * @param category - Optional category filter
   * @returns Promise resolving to array of storage references
   */
  listRefs(testId: string, category?: StorageCategory): Promise<StorageRef[]>;
}

// ============================================================================
// Test Types
// ============================================================================

/**
 * Types of actions that can be performed in a test step.
 */
export type TestStepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'scroll'
  | 'select'
  | 'hover'
  | 'press'
  | 'checkpoint';

/**
 * Base interface for all test steps.
 */
interface BaseTestStep {
  /** Unique identifier for this step within the test */
  id: string;

  /** Human-readable description of what this step does */
  description?: string;

  /** Type of action to perform */
  action: TestStepAction;
}

/**
 * Navigate to a URL.
 */
export interface NavigateStep extends BaseTestStep {
  action: 'navigate';
  url: string;
  options?: NavigateOptions;
}

/**
 * Click an element on the page.
 */
export interface ClickStep extends BaseTestStep {
  action: 'click';
  selector: string;
  options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  };
}

/**
 * Type text into an element.
 */
export interface TypeStep extends BaseTestStep {
  action: 'type';
  selector: string;
  text: string;
  options?: {
    delay?: number;
    clear?: boolean;
  };
}

/**
 * Wait for a condition or duration.
 */
export interface WaitStep extends BaseTestStep {
  action: 'wait';
  condition: WaitCondition;
}

/**
 * Scroll the page or an element.
 */
export interface ScrollStep extends BaseTestStep {
  action: 'scroll';
  selector?: string;
  options: {
    x?: number;
    y?: number;
    behavior?: 'auto' | 'smooth';
  };
}

/**
 * Select an option from a dropdown.
 */
export interface SelectStep extends BaseTestStep {
  action: 'select';
  selector: string;
  value: string | string[];
}

/**
 * Hover over an element.
 */
export interface HoverStep extends BaseTestStep {
  action: 'hover';
  selector: string;
}

/**
 * Press a keyboard key.
 */
export interface PressStep extends BaseTestStep {
  action: 'press';
  key: string;
  options?: {
    delay?: number;
  };
}

/**
 * Create a checkpoint with validations.
 */
export interface CheckpointStep extends BaseTestStep {
  action: 'checkpoint';
  checkpoint: CheckpointDefinition;
}

/**
 * Union type of all possible test steps.
 */
export type TestStep =
  | NavigateStep
  | ClickStep
  | TypeStep
  | WaitStep
  | ScrollStep
  | SelectStep
  | HoverStep
  | PressStep
  | CheckpointStep;

/**
 * Options for navigation actions.
 */
export interface NavigateOptions {
  /** Maximum time to wait for navigation in milliseconds */
  timeout?: number;

  /** When to consider navigation complete */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

  /** HTTP referer header value */
  referer?: string;
}

/**
 * Conditions that can be waited for.
 */
export type WaitCondition =
  | { type: 'timeout'; duration: number }
  | { type: 'selector'; selector: string; visible?: boolean }
  | { type: 'function'; fn: string; args?: any[] }
  | { type: 'navigation'; options?: NavigateOptions }
  | { type: 'networkidle'; timeout?: number };

/**
 * Configuration for a test.
 */
export interface TestConfig {
  /** Unique identifier for the test */
  id: string;

  /** Human-readable name for the test */
  name: string;

  /** Detailed description of what the test validates */
  description?: string;

  /** Tags for organizing and filtering tests */
  tags?: string[];

  /** Default timeout for steps in milliseconds */
  timeout?: number;

  /** Browser viewport configuration */
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };

  /** Whether to run in headless mode */
  headless?: boolean;

  /** Number of times to retry failed tests */
  retries?: number;

  /** Custom environment variables for the test */
  env?: Record<string, string>;
}

/**
 * Complete test definition including configuration and steps.
 */
export interface TestDefinition extends TestConfig {
  /** Ordered list of steps to execute */
  steps: TestStep[];

  /** Setup steps to run before the test */
  beforeAll?: TestStep[];

  /** Cleanup steps to run after the test */
  afterAll?: TestStep[];
}

/**
 * Result of executing a test.
 */
export interface TestResult {
  /** Test identifier */
  testId: string;

  /** Test run identifier for this execution */
  runId: string;

  /** Overall test status */
  status: 'passed' | 'failed' | 'skipped' | 'error';

  /** When the test started (ISO 8601) */
  startTime: string;

  /** When the test ended (ISO 8601) */
  endTime: string;

  /** Total duration in milliseconds */
  duration: number;

  /** Results for each checkpoint */
  checkpoints: CheckpointState[];

  /** Error information if the test failed */
  error?: {
    message: string;
    stack?: string;
    step?: string;
  };

  /** Storage references for test artifacts */
  artifacts: StorageRef[];
}

// ============================================================================
// Checkpoint Types
// ============================================================================

/**
 * Definition of a checkpoint within a test.
 * Specifies what to capture and validate at a specific point.
 */
export interface CheckpointDefinition {
  /** Unique identifier for the checkpoint */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this checkpoint validates */
  description?: string;

  /** What to capture at this checkpoint */
  capture: {
    /** Capture a screenshot */
    screenshot?: boolean | ScreenshotOptions;

    /** Capture HTML snapshot */
    html?: boolean;

    /** Capture console logs */
    console?: boolean;

    /** Capture network activity */
    network?: boolean;

    /** Capture performance metrics */
    performance?: boolean;
  };

  /** Validations to perform */
  validations?: CheckpointValidations;
}

/**
 * State of a checkpoint after execution.
 * Contains storage references to captured data, not the raw data itself.
 */
export interface CheckpointState {
  /** Checkpoint identifier */
  checkpointId: string;

  /** Test identifier */
  testId: string;

  /** Test run identifier */
  runId: string;

  /** When the checkpoint was captured */
  timestamp: string;

  /** Storage references for captured artifacts */
  refs: CheckpointRefs;

  /** Validation results */
  validations?: ValidationResult[];

  /** Overall checkpoint status */
  status: 'passed' | 'failed' | 'skipped';

  /** Duration to capture and validate in milliseconds */
  duration: number;
}

/**
 * Storage references for checkpoint artifacts.
 * All captured data is stored and referenced, not embedded.
 */
export interface CheckpointRefs {
  /** Reference to screenshot image */
  screenshot?: StorageRef;

  /** Reference to HTML snapshot */
  html?: StorageRef;

  /** Reference to console logs */
  console?: StorageRef;

  /** Reference to network logs */
  network?: StorageRef;

  /** Reference to performance metrics */
  performance?: StorageRef;

  /** Reference to visual diff result (if comparing) */
  visualDiff?: StorageRef;
}

/**
 * Validations to perform at a checkpoint.
 */
export interface CheckpointValidations {
  /** DOM-based validations */
  dom?: DOMValidations;

  /** Console log validations */
  console?: ConsoleValidations;

  /** Visual comparison validations */
  visual?: VisualValidations;

  /** Custom validation functions */
  custom?: Array<{
    name: string;
    fn: string;
    args?: any[];
  }>;
}

/**
 * Result of executing validations.
 */
export interface ValidationResult {
  /** Type of validation performed */
  type: 'dom' | 'console' | 'visual' | 'custom';

  /** Validation name/identifier */
  name: string;

  /** Whether the validation passed */
  passed: boolean;

  /** Detailed message about the result */
  message: string;

  /** Individual assertion results */
  assertions?: AssertionResult[];

  /** Duration of validation in milliseconds */
  duration: number;
}

/**
 * Result of a single assertion.
 */
export interface AssertionResult {
  /** What was being asserted */
  description: string;

  /** Whether the assertion passed */
  passed: boolean;

  /** Expected value */
  expected?: any;

  /** Actual value */
  actual?: any;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * DOM-based validations.
 */
export interface DOMValidations {
  /** Elements that must exist */
  exists?: string[];

  /** Elements that must not exist */
  notExists?: string[];

  /** Elements that must be visible */
  visible?: string[];

  /** Elements that must be hidden */
  hidden?: string[];

  /** Text content assertions */
  textContent?: Array<{
    selector: string;
    text: string;
    match?: 'exact' | 'contains' | 'regex';
  }>;

  /** Attribute value assertions */
  attributes?: Array<{
    selector: string;
    attribute: string;
    value: string;
    match?: 'exact' | 'contains' | 'regex';
  }>;

  /** Element count assertions */
  count?: Array<{
    selector: string;
    count: number;
    operator?: 'equal' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
  }>;
}

/**
 * Console log validations.
 */
export interface ConsoleValidations {
  /** Expected console messages */
  expectedMessages?: Array<{
    level: 'log' | 'info' | 'warn' | 'error' | 'debug';
    text: string;
    match?: 'exact' | 'contains' | 'regex';
  }>;

  /** Console messages that should not appear */
  forbiddenMessages?: Array<{
    level?: 'log' | 'info' | 'warn' | 'error' | 'debug';
    text: string;
    match?: 'exact' | 'contains' | 'regex';
  }>;

  /** Maximum allowed errors */
  maxErrors?: number;

  /** Maximum allowed warnings */
  maxWarnings?: number;
}

/**
 * Visual comparison validations.
 */
export interface VisualValidations {
  /** Reference screenshot to compare against */
  baseline?: StorageRef | string;

  /** Maximum allowed difference threshold (0-1) */
  threshold?: number;

  /** Regions to include in comparison */
  includeRegions?: VisualRegion[];

  /** Regions to exclude from comparison */
  excludeRegions?: VisualRegion[];

  /** Whether to fail on layout shifts */
  failOnLayoutShift?: boolean;
}

/**
 * Context passed to validation functions.
 */
export interface ValidationContext {
  /** Storage provider for retrieving artifacts */
  storage: StorageProvider;

  /** References to checkpoint artifacts */
  refs: CheckpointRefs;

  /** Test configuration */
  testConfig: TestConfig;

  /** Checkpoint definition */
  checkpoint: CheckpointDefinition;
}

/**
 * Region of the screen for visual comparisons.
 */
export interface VisualRegion {
  /** X coordinate (pixels or percentage) */
  x: number | string;

  /** Y coordinate (pixels or percentage) */
  y: number | string;

  /** Width (pixels or percentage) */
  width: number | string;

  /** Height (pixels or percentage) */
  height: number | string;

  /** Optional name for the region */
  name?: string;
}

// ============================================================================
// Chrome DevTools Types
// ============================================================================

/**
 * Result of a navigation action.
 */
export interface NavigationResult {
  /** Final URL after navigation (may differ due to redirects) */
  url: string;

  /** HTTP status code */
  status: number;

  /** Whether the navigation was successful */
  success: boolean;

  /** Time taken for navigation in milliseconds */
  duration: number;

  /** Navigation timing metrics */
  timing?: {
    domContentLoaded: number;
    loadComplete: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };

  /** Error information if navigation failed */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Console message entry from the browser.
 */
export interface ConsoleEntry {
  /** Message level/type */
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'verbose';

  /** Message text */
  text: string;

  /** When the message was logged (ISO 8601) */
  timestamp: string;

  /** Source location of the log */
  source?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };

  /** Stack trace for errors */
  stackTrace?: string;

  /** Arguments passed to console method */
  args?: any[];
}

/**
 * Filter for console entries.
 */
export interface ConsoleFilter {
  /** Filter by message level */
  level?: ConsoleEntry['level'] | ConsoleEntry['level'][];

  /** Filter by text content (regex or string) */
  text?: string | RegExp;

  /** Filter by time range */
  timestampRange?: {
    start: string;
    end: string;
  };

  /** Maximum number of entries to return */
  limit?: number;
}

/**
 * Summary of console activity.
 */
export interface ConsoleSummary {
  /** Total number of console messages */
  total: number;

  /** Count by level */
  byLevel: {
    log: number;
    info: number;
    warn: number;
    error: number;
    debug: number;
    verbose: number;
  };

  /** Unique error messages */
  uniqueErrors: string[];

  /** Unique warning messages */
  uniqueWarnings: string[];
}

/**
 * Base DOM node interface.
 */
export interface DOMNode {
  /** Node type (element, text, comment, etc.) */
  nodeType: number;

  /** Node name (tag name for elements) */
  nodeName: string;

  /** Node value (for text nodes, comments, etc.) */
  nodeValue?: string;

  /** Child nodes */
  childNodes?: DOMNode[];
}

/**
 * DOM element interface (extends DOMNode).
 */
export interface DOMElement extends DOMNode {
  nodeType: 1; // ELEMENT_NODE

  /** Tag name in uppercase */
  tagName: string;

  /** Element attributes */
  attributes: Record<string, string>;

  /** Element's ID */
  id?: string;

  /** Element's classes */
  className?: string;

  /** Inner text content */
  textContent?: string;

  /** Inner HTML */
  innerHTML?: string;

  /** Bounding box */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Computed styles */
  computedStyle?: Record<string, string>;

  /** Whether the element is visible */
  visible?: boolean;
}

/**
 * Options for capturing screenshots.
 */
export interface ScreenshotOptions {
  /** Image format */
  type?: 'png' | 'jpeg' | 'webp';

  /** Image quality (0-100, for jpeg/webp) */
  quality?: number;

  /** Whether to capture full page or just viewport */
  fullPage?: boolean;

  /** Specific region to capture */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Whether to omit the default white background */
  omitBackground?: boolean;

  /** Specific element to capture */
  selector?: string;
}

// ============================================================================
// Visual Diff Types
// ============================================================================

/**
 * Options for visual diff comparison.
 */
export interface DiffOptions {
  /** Difference threshold (0-1, where 0 is identical) */
  threshold?: number;

  /** Whether to include diff image in result */
  includeDiffImage?: boolean;

  /** Color to use for highlighting differences */
  diffColor?: {
    r: number;
    g: number;
    b: number;
  };

  /** Regions to include in comparison */
  includeRegions?: VisualRegion[];

  /** Regions to exclude from comparison */
  excludeRegions?: VisualRegion[];

  /** Anti-aliasing handling */
  antialiasing?: boolean;

  /** Ignore colors and compare structure only */
  ignoreColors?: boolean;
}

/**
 * Result of a visual diff comparison.
 */
export interface DiffResult {
  /** Whether the images match within threshold */
  passed: boolean;

  /** Percentage difference (0-100) */
  diffPercentage: number;

  /** Number of different pixels */
  diffPixels: number;

  /** Total number of pixels compared */
  totalPixels: number;

  /** Storage reference to diff image (if generated) */
  diffImageRef?: StorageRef;

  /** Bounding box of the difference region */
  diffBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Detailed analysis of differences */
  analysis?: {
    /** Areas with significant differences */
    significantRegions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      diffPercentage: number;
    }>;

    /** Color histogram comparison */
    colorHistogram?: {
      correlation: number;
    };
  };
}
