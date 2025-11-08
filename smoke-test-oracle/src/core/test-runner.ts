/**
 * Test Runner
 *
 * Executes individual test steps including navigation, interactions, and waits.
 * Captures DOM, screenshots, and console logs at appropriate times.
 */

import type {
  TestStep,
  NavigateStep,
  ClickStep,
  TypeStep,
  WaitStep,
  ScrollStep,
  SelectStep,
  HoverStep,
  PressStep,
  NavigationResult,
} from './types.js';
import type { ChromeDevToolsWrapper } from '../chrome/devtools-wrapper.js';

/**
 * Result of executing a test step
 */
export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  duration: number;
  error?: {
    message: string;
    stack?: string;
  };
  data?: any;
}

/**
 * Test runner class
 */
export class TestRunner {
  private chrome: ChromeDevToolsWrapper;

  constructor(chrome: ChromeDevToolsWrapper) {
    this.chrome = chrome;
  }

  /**
   * Execute a single test step
   */
  async executeStep(step: TestStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      let data: any;

      switch (step.action) {
        case 'navigate':
          data = await this.executeNavigate(step);
          break;

        case 'click':
          data = await this.executeClick(step);
          break;

        case 'type':
          data = await this.executeType(step);
          break;

        case 'wait':
          data = await this.executeWait(step);
          break;

        case 'scroll':
          data = await this.executeScroll(step);
          break;

        case 'select':
          data = await this.executeSelect(step);
          break;

        case 'hover':
          data = await this.executeHover(step);
          break;

        case 'press':
          data = await this.executePress(step);
          break;

        case 'checkpoint':
          // Checkpoints are handled by the orchestrator
          data = { message: 'Checkpoint handled by orchestrator' };
          break;

        default:
          throw new Error(`Unknown step action: ${(step as any).action}`);
      }

      const duration = Date.now() - startTime;

      return {
        stepId: step.id,
        success: true,
        duration,
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        stepId: step.id,
        success: false,
        duration,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Execute navigation step
   */
  private async executeNavigate(step: NavigateStep): Promise<NavigationResult> {
    try {
      const result = await this.chrome.navigate(step.url, step.options);

      if (!result.success) {
        throw new Error(
          result.error?.message || `Navigation to ${step.url} failed`
        );
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to navigate to ${step.url}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute click step
   */
  private async executeClick(step: ClickStep): Promise<void> {
    try {
      await this.chrome.click(step.selector, step.options);
    } catch (error) {
      throw new Error(
        `Failed to click ${step.selector}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute type step
   */
  private async executeType(step: TypeStep): Promise<void> {
    try {
      // If clear option is set, first clear the input
      if (step.options?.clear) {
        await this.chrome.click(step.selector);
        await this.chrome.evaluate(`
          const element = document.querySelector('${step.selector}');
          if (element) {
            element.value = '';
          }
        `);
      }

      await this.chrome.type(step.selector, step.text, {
        delay: step.options?.delay,
      });
    } catch (error) {
      throw new Error(
        `Failed to type into ${step.selector}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute wait step
   */
  private async executeWait(step: WaitStep): Promise<void> {
    try {
      const condition = step.condition;

      switch (condition.type) {
        case 'timeout':
          await this.waitForTimeout(condition.duration);
          break;

        case 'selector':
          await this.chrome.waitForSelector(condition.selector, {
            visible: condition.visible,
            timeout: 30000,
          });
          break;

        case 'function':
          await this.waitForFunction(condition.fn, condition.args);
          break;

        case 'navigation':
          // Wait for navigation to complete
          await this.waitForTimeout(1000);
          break;

        case 'networkidle':
          // Wait for network to be idle
          await this.waitForTimeout(condition.timeout || 2000);
          break;

        default:
          throw new Error(`Unknown wait condition type: ${(condition as any).type}`);
      }
    } catch (error) {
      throw new Error(
        `Wait failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute scroll step
   */
  private async executeScroll(step: ScrollStep): Promise<void> {
    try {
      const { x = 0, y = 0, behavior = 'auto' } = step.options;

      if (step.selector) {
        // Scroll element into view
        await this.chrome.evaluate(`
          const element = document.querySelector('${step.selector}');
          if (element) {
            element.scrollIntoView({ behavior: '${behavior}' });
          }
        `);
      } else {
        // Scroll window
        await this.chrome.evaluate(`
          window.scrollTo({
            left: ${x},
            top: ${y},
            behavior: '${behavior}'
          });
        `);
      }
    } catch (error) {
      throw new Error(
        `Failed to scroll: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute select step
   */
  private async executeSelect(step: SelectStep): Promise<void> {
    try {
      const values = Array.isArray(step.value) ? step.value : [step.value];

      await this.chrome.evaluate(`
        const select = document.querySelector('${step.selector}');
        if (select && select.tagName === 'SELECT') {
          const values = ${JSON.stringify(values)};
          for (const option of select.options) {
            option.selected = values.includes(option.value);
          }
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `);
    } catch (error) {
      throw new Error(
        `Failed to select option in ${step.selector}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute hover step
   */
  private async executeHover(step: HoverStep): Promise<void> {
    try {
      await this.chrome.evaluate(`
        const element = document.querySelector('${step.selector}');
        if (element) {
          const event = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(event);
        }
      `);
    } catch (error) {
      throw new Error(
        `Failed to hover over ${step.selector}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute press step
   */
  private async executePress(step: PressStep): Promise<void> {
    try {
      await this.chrome.evaluate(`
        const event = new KeyboardEvent('keydown', {
          key: '${step.key}',
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      `);

      if (step.options?.delay) {
        await this.waitForTimeout(step.options.delay);
      }

      await this.chrome.evaluate(`
        const event = new KeyboardEvent('keyup', {
          key: '${step.key}',
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      `);
    } catch (error) {
      throw new Error(
        `Failed to press key ${step.key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Wait for a timeout
   */
  private async waitForTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for a function to return true
   */
  private async waitForFunction(fn: string, args?: any[]): Promise<void> {
    const timeout = 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.chrome.evaluate(`
          (function() {
            ${fn}
          })(...${JSON.stringify(args || [])})
        `);

        if (result) {
          return;
        }
      } catch {
        // Continue waiting
      }

      await this.waitForTimeout(100);
    }

    throw new Error(`Wait for function timed out after ${timeout}ms`);
  }

  /**
   * Capture current page state
   */
  async capturePageState(): Promise<{
    html: string;
    screenshot: Buffer;
    consoleLogs: any[];
    url: string;
  }> {
    try {
      const [domResult, screenshot, consoleLogs, url] = await Promise.all([
        this.chrome.getDOM(),
        this.chrome.captureScreenshot(),
        this.chrome.getConsoleLogs(),
        this.chrome.getUrl(),
      ]);

      return {
        html: domResult.html,
        screenshot: Buffer.from(screenshot.data, 'base64'),
        consoleLogs,
        url,
      };
    } catch (error) {
      throw new Error(
        `Failed to capture page state: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
