/**
 * Test Builder API
 *
 * Fluent API for building smoke tests with a chainable interface.
 * Provides TestBuilder factory and SmokeTest class for test definition.
 */

import { randomUUID } from 'crypto';
import type {
  TestDefinition,
  TestStep,
  NavigateStep,
  ClickStep,
  TypeStep,
  WaitStep,
  ScrollStep,
  SelectStep,
  HoverStep,
  PressStep,
  CheckpointStep,
  NavigateOptions,
  CheckpointDefinition,
  TestConfig,
  TestResult,
  WaitCondition,
  ScreenshotOptions,
} from '../core/types.js';
import { TestOrchestrator, type OrchestratorConfig } from '../core/orchestrator.js';

/**
 * Fluent test builder class
 */
export class SmokeTest {
  private testName: string;
  private testDescription?: string;
  private testTags: string[] = [];
  private steps: TestStep[] = [];
  private beforeAllSteps: TestStep[] = [];
  private afterAllSteps: TestStep[] = [];
  private testTimeout?: number;
  private testViewport?: { width: number; height: number; deviceScaleFactor?: number };
  private testHeadless?: boolean;
  private testRetries?: number;
  private testEnv?: Record<string, string>;

  constructor(name: string) {
    this.testName = name;
  }

  /**
   * Set test description
   */
  description(desc: string): this {
    this.testDescription = desc;
    return this;
  }

  /**
   * Add tags to the test
   */
  tags(...tags: string[]): this {
    this.testTags.push(...tags);
    return this;
  }

  /**
   * Set default timeout for steps
   */
  timeout(ms: number): this {
    this.testTimeout = ms;
    return this;
  }

  /**
   * Set viewport configuration
   */
  viewport(config: { width: number; height: number; deviceScaleFactor?: number }): this {
    this.testViewport = config;
    return this;
  }

  /**
   * Set headless mode
   */
  headless(enabled: boolean = true): this {
    this.testHeadless = enabled;
    return this;
  }

  /**
   * Set retry count
   */
  retries(count: number): this {
    this.testRetries = count;
    return this;
  }

  /**
   * Set environment variables
   */
  env(vars: Record<string, string>): this {
    this.testEnv = { ...this.testEnv, ...vars };
    return this;
  }

  /**
   * Navigate to a URL
   */
  navigate(url: string, options?: NavigateOptions): this {
    const step: NavigateStep = {
      id: randomUUID(),
      action: 'navigate',
      url,
      options,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Click an element
   */
  click(
    selector: string,
    options?: {
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
      delay?: number;
    }
  ): this {
    const step: ClickStep = {
      id: randomUUID(),
      action: 'click',
      selector,
      options,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Type text into an element
   */
  type(
    selector: string,
    text: string,
    options?: {
      delay?: number;
      clear?: boolean;
    }
  ): this {
    const step: TypeStep = {
      id: randomUUID(),
      action: 'type',
      selector,
      text,
      options,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Wait for a condition
   */
  wait(condition: WaitCondition): this;
  wait(ms: number): this;
  wait(selector: string, options?: { visible?: boolean; timeout?: number }): this;
  wait(
    conditionOrMsOrSelector: WaitCondition | number | string,
    options?: { visible?: boolean; timeout?: number }
  ): this {
    let condition: WaitCondition;

    if (typeof conditionOrMsOrSelector === 'number') {
      // Wait for timeout
      condition = {
        type: 'timeout',
        duration: conditionOrMsOrSelector,
      };
    } else if (typeof conditionOrMsOrSelector === 'string') {
      // Wait for selector
      condition = {
        type: 'selector',
        selector: conditionOrMsOrSelector,
        visible: options?.visible,
      };
    } else {
      // Wait condition object
      condition = conditionOrMsOrSelector;
    }

    const step: WaitStep = {
      id: randomUUID(),
      action: 'wait',
      condition,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Scroll the page or an element
   */
  scroll(options: {
    selector?: string;
    x?: number;
    y?: number;
    behavior?: 'auto' | 'smooth';
  }): this {
    const step: ScrollStep = {
      id: randomUUID(),
      action: 'scroll',
      selector: options.selector,
      options: {
        x: options.x,
        y: options.y,
        behavior: options.behavior,
      },
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Select an option from a dropdown
   */
  select(selector: string, value: string | string[]): this {
    const step: SelectStep = {
      id: randomUUID(),
      action: 'select',
      selector,
      value,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Hover over an element
   */
  hover(selector: string): this {
    const step: HoverStep = {
      id: randomUUID(),
      action: 'hover',
      selector,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Press a keyboard key
   */
  press(key: string, options?: { delay?: number }): this {
    const step: PressStep = {
      id: randomUUID(),
      action: 'press',
      key,
      options,
    };
    this.steps.push(step);
    return this;
  }

  /**
   * Create a checkpoint with validations
   */
  checkpoint(
    name: string,
    config?: {
      description?: string;
      capture?: {
        screenshot?: boolean | ScreenshotOptions;
        html?: boolean;
        console?: boolean;
        network?: boolean;
        performance?: boolean;
      };
      validations?: CheckpointDefinition['validations'];
    }
  ): this {
    const checkpoint: CheckpointDefinition = {
      id: randomUUID(),
      name,
      description: config?.description,
      capture: config?.capture || {
        screenshot: true,
        html: true,
        console: true,
      },
      validations: config?.validations,
    };

    const step: CheckpointStep = {
      id: randomUUID(),
      action: 'checkpoint',
      checkpoint,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add a step to run before all test steps
   */
  beforeAll(callback: (test: SmokeTest) => void): this {
    const beforeTest = new SmokeTest('beforeAll');
    callback(beforeTest);
    this.beforeAllSteps.push(...beforeTest.steps);
    return this;
  }

  /**
   * Add a step to run after all test steps
   */
  afterAll(callback: (test: SmokeTest) => void): this {
    const afterTest = new SmokeTest('afterAll');
    callback(afterTest);
    this.afterAllSteps.push(...afterTest.steps);
    return this;
  }

  /**
   * Convert to TestDefinition
   */
  toTestDefinition(): TestDefinition {
    const config: TestConfig = {
      id: randomUUID(),
      name: this.testName,
      description: this.testDescription,
      tags: this.testTags.length > 0 ? this.testTags : undefined,
      timeout: this.testTimeout,
      viewport: this.testViewport,
      headless: this.testHeadless,
      retries: this.testRetries,
      env: this.testEnv,
    };

    return {
      ...config,
      steps: this.steps,
      beforeAll: this.beforeAllSteps.length > 0 ? this.beforeAllSteps : undefined,
      afterAll: this.afterAllSteps.length > 0 ? this.afterAllSteps : undefined,
    };
  }

  /**
   * Run the test
   */
  async run(config: OrchestratorConfig): Promise<TestResult> {
    const testDefinition = this.toTestDefinition();
    const orchestrator = new TestOrchestrator(config);

    try {
      const result = await orchestrator.execute(testDefinition);
      return result;
    } finally {
      await orchestrator.cleanup();
    }
  }
}

/**
 * Test builder factory
 */
export class TestBuilder {
  /**
   * Create a new test
   */
  static create(name: string): SmokeTest {
    return new SmokeTest(name);
  }

  /**
   * Create a test from an existing definition
   */
  static fromDefinition(definition: TestDefinition): SmokeTest {
    const test = new SmokeTest(definition.name);

    if (definition.description) {
      test.description(definition.description);
    }

    if (definition.tags) {
      test.tags(...definition.tags);
    }

    if (definition.timeout) {
      test.timeout(definition.timeout);
    }

    if (definition.viewport) {
      test.viewport(definition.viewport);
    }

    if (definition.headless !== undefined) {
      test.headless(definition.headless);
    }

    if (definition.retries !== undefined) {
      test.retries(definition.retries);
    }

    if (definition.env) {
      test.env(definition.env);
    }

    // Add steps
    (test as any).steps = [...definition.steps];

    if (definition.beforeAll) {
      (test as any).beforeAllSteps = [...definition.beforeAll];
    }

    if (definition.afterAll) {
      (test as any).afterAllSteps = [...definition.afterAll];
    }

    return test;
  }
}
