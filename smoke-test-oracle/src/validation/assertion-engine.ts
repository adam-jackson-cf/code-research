import {
  AssertionResult,
  DOMValidations,
  ConsoleValidations,
  StorageRef,
} from '../core/types.js';
import { StorageManager, ConsoleLogEntry } from '../storage/index.js';
import {
  getErrors,
  getWarnings,
} from './error-filter.js';
import * as cheerio from 'cheerio';

/**
 * Assertion engine for evaluating checkpoint validations.
 * Supports DOM, console, and custom assertions.
 */
export class AssertionEngine {
  constructor(private storage: StorageManager) {}

  /**
   * Evaluate all DOM validations.
   *
   * @param validations - DOM validations to evaluate
   * @param htmlRef - Reference to HTML snapshot
   * @returns Array of assertion results
   */
  async evaluateDOMValidations(
    validations: DOMValidations,
    htmlRef?: StorageRef
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    if (!htmlRef) {
      results.push({
        description: 'DOM validation skipped - no HTML snapshot available',
        passed: false,
        error: 'No HTML snapshot reference provided',
      });
      return results;
    }

    try {
      // Retrieve HTML from storage
      const html = await this.storage.retrieveDOM(htmlRef);
      const $ = cheerio.load(html) as any as cheerio.CheerioAPI;

      // Validate exists
      if (validations.exists) {
        for (const selector of validations.exists) {
          results.push(this.evaluateExists($, selector));
        }
      }

      // Validate notExists
      if (validations.notExists) {
        for (const selector of validations.notExists) {
          results.push(this.evaluateNotExists($, selector));
        }
      }

      // Validate visible
      if (validations.visible) {
        for (const selector of validations.visible) {
          results.push(this.evaluateVisible($, selector));
        }
      }

      // Validate hidden
      if (validations.hidden) {
        for (const selector of validations.hidden) {
          results.push(this.evaluateHidden($, selector));
        }
      }

      // Validate text content
      if (validations.textContent) {
        for (const validation of validations.textContent) {
          results.push(this.evaluateTextContent($, validation));
        }
      }

      // Validate attributes
      if (validations.attributes) {
        for (const validation of validations.attributes) {
          results.push(this.evaluateAttribute($, validation));
        }
      }

      // Validate count
      if (validations.count) {
        for (const validation of validations.count) {
          results.push(this.evaluateCount($, validation));
        }
      }
    } catch (error) {
      results.push({
        description: 'DOM validation failed',
        passed: false,
        error: `Failed to load or parse HTML: ${error}`,
      });
    }

    return results;
  }

  /**
   * Evaluate all console validations.
   *
   * @param validations - Console validations to evaluate
   * @param consoleRef - Reference to console logs
   * @returns Array of assertion results
   */
  async evaluateConsoleValidations(
    validations: ConsoleValidations,
    consoleRef?: StorageRef
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    if (!consoleRef) {
      results.push({
        description: 'Console validation skipped - no console logs available',
        passed: false,
        error: 'No console logs reference provided',
      });
      return results;
    }

    try {
      // Retrieve console logs from storage
      const entries = await this.storage.retrieveConsoleLogs(consoleRef);

      // Get errors and warnings
      const errors = getErrors(entries);
      const warnings = getWarnings(entries);

      // Validate maxErrors
      if (validations.maxErrors !== undefined) {
        results.push(this.evaluateMaxErrors(errors, validations.maxErrors));
      }

      // Validate maxWarnings
      if (validations.maxWarnings !== undefined) {
        results.push(this.evaluateMaxWarnings(warnings, validations.maxWarnings));
      }

      // Validate expected messages
      if (validations.expectedMessages) {
        for (const expectedMsg of validations.expectedMessages) {
          results.push(this.evaluateExpectedMessage(entries, expectedMsg));
        }
      }

      // Validate forbidden messages
      if (validations.forbiddenMessages) {
        for (const forbiddenMsg of validations.forbiddenMessages) {
          results.push(this.evaluateForbiddenMessage(entries, forbiddenMsg));
        }
      }
    } catch (error) {
      results.push({
        description: 'Console validation failed',
        passed: false,
        error: `Failed to load console logs: ${error}`,
      });
    }

    return results;
  }

  // ============================================================================
  // DOM Assertion Evaluators
  // ============================================================================

  /**
   * Evaluate that an element exists in the DOM.
   */
  private evaluateExists($: cheerio.CheerioAPI, selector: string): AssertionResult {
    const elements = $(selector);
    const exists = elements.length > 0;

    return {
      description: `Element "${selector}" should exist`,
      passed: exists,
      expected: 'Element exists',
      actual: exists ? `Found ${elements.length} element(s)` : 'Element not found',
      error: exists ? undefined : `Element "${selector}" not found in DOM`,
    };
  }

  /**
   * Evaluate that an element does not exist in the DOM.
   */
  private evaluateNotExists($: cheerio.CheerioAPI, selector: string): AssertionResult {
    const elements = $(selector);
    const notExists = elements.length === 0;

    return {
      description: `Element "${selector}" should not exist`,
      passed: notExists,
      expected: 'Element does not exist',
      actual: notExists ? 'Element not found' : `Found ${elements.length} element(s)`,
      error: notExists ? undefined : `Element "${selector}" found in DOM but should not exist`,
    };
  }

  /**
   * Evaluate that an element is visible.
   */
  private evaluateVisible($: cheerio.CheerioAPI, selector: string): AssertionResult {
    const element = $(selector).first();

    if (element.length === 0) {
      return {
        description: `Element "${selector}" should be visible`,
        passed: false,
        expected: 'Element is visible',
        actual: 'Element not found',
        error: `Element "${selector}" not found in DOM`,
      };
    }

    // Check if element has display: none or visibility: hidden
    const style = element.attr('style') || '';
    const isHidden = style.includes('display:none') ||
                    style.includes('display: none') ||
                    style.includes('visibility:hidden') ||
                    style.includes('visibility: hidden');

    const isVisible = !isHidden;

    return {
      description: `Element "${selector}" should be visible`,
      passed: isVisible,
      expected: 'Element is visible',
      actual: isVisible ? 'Element is visible' : 'Element is hidden',
      error: isVisible ? undefined : `Element "${selector}" is hidden`,
    };
  }

  /**
   * Evaluate that an element is hidden.
   */
  private evaluateHidden($: cheerio.CheerioAPI, selector: string): AssertionResult {
    const element = $(selector).first();

    if (element.length === 0) {
      return {
        description: `Element "${selector}" should be hidden`,
        passed: false,
        expected: 'Element is hidden',
        actual: 'Element not found',
        error: `Element "${selector}" not found in DOM`,
      };
    }

    // Check if element has display: none or visibility: hidden
    const style = element.attr('style') || '';
    const isHidden = style.includes('display:none') ||
                    style.includes('display: none') ||
                    style.includes('visibility:hidden') ||
                    style.includes('visibility: hidden');

    return {
      description: `Element "${selector}" should be hidden`,
      passed: isHidden,
      expected: 'Element is hidden',
      actual: isHidden ? 'Element is hidden' : 'Element is visible',
      error: isHidden ? undefined : `Element "${selector}" is visible but should be hidden`,
    };
  }

  /**
   * Evaluate text content of an element.
   */
  private evaluateTextContent(
    $: cheerio.CheerioAPI,
    validation: {
      selector: string;
      text: string;
      match?: 'exact' | 'contains' | 'regex';
    }
  ): AssertionResult {
    const element = $(validation.selector).first();

    if (element.length === 0) {
      return {
        description: `Text content of "${validation.selector}"`,
        passed: false,
        expected: validation.text,
        actual: 'Element not found',
        error: `Element "${validation.selector}" not found in DOM`,
      };
    }

    const actualText = element.text().trim();
    const matchType = validation.match || 'contains';
    let passed = false;

    switch (matchType) {
      case 'exact':
        passed = actualText === validation.text;
        break;
      case 'contains':
        passed = actualText.includes(validation.text);
        break;
      case 'regex':
        try {
          const regex = new RegExp(validation.text);
          passed = regex.test(actualText);
        } catch (error) {
          return {
            description: `Text content of "${validation.selector}"`,
            passed: false,
            expected: validation.text,
            actual: actualText,
            error: `Invalid regex pattern: ${validation.text}`,
          };
        }
        break;
    }

    return {
      description: `Text content of "${validation.selector}" should ${matchType} "${validation.text}"`,
      passed,
      expected: validation.text,
      actual: actualText,
      error: passed ? undefined : `Text mismatch for "${validation.selector}"`,
    };
  }

  /**
   * Evaluate attribute value of an element.
   */
  private evaluateAttribute(
    $: cheerio.CheerioAPI,
    validation: {
      selector: string;
      attribute: string;
      value: string;
      match?: 'exact' | 'contains' | 'regex';
    }
  ): AssertionResult {
    const element = $(validation.selector).first();

    if (element.length === 0) {
      return {
        description: `Attribute "${validation.attribute}" of "${validation.selector}"`,
        passed: false,
        expected: validation.value,
        actual: 'Element not found',
        error: `Element "${validation.selector}" not found in DOM`,
      };
    }

    const actualValue = element.attr(validation.attribute);

    if (actualValue === undefined) {
      return {
        description: `Attribute "${validation.attribute}" of "${validation.selector}"`,
        passed: false,
        expected: validation.value,
        actual: 'Attribute not found',
        error: `Attribute "${validation.attribute}" not found on element "${validation.selector}"`,
      };
    }

    const matchType = validation.match || 'exact';
    let passed = false;

    switch (matchType) {
      case 'exact':
        passed = actualValue === validation.value;
        break;
      case 'contains':
        passed = actualValue.includes(validation.value);
        break;
      case 'regex':
        try {
          const regex = new RegExp(validation.value);
          passed = regex.test(actualValue);
        } catch (error) {
          return {
            description: `Attribute "${validation.attribute}" of "${validation.selector}"`,
            passed: false,
            expected: validation.value,
            actual: actualValue,
            error: `Invalid regex pattern: ${validation.value}`,
          };
        }
        break;
    }

    return {
      description: `Attribute "${validation.attribute}" of "${validation.selector}" should ${matchType} "${validation.value}"`,
      passed,
      expected: validation.value,
      actual: actualValue,
      error: passed ? undefined : `Attribute value mismatch for "${validation.selector}"`,
    };
  }

  /**
   * Evaluate element count.
   */
  private evaluateCount(
    $: cheerio.CheerioAPI,
    validation: {
      selector: string;
      count: number;
      operator?: 'equal' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
    }
  ): AssertionResult {
    const elements = $(validation.selector);
    const actualCount = elements.length;
    const operator = validation.operator || 'equal';
    let passed = false;
    let operatorSymbol = '=';

    switch (operator) {
      case 'equal':
        passed = actualCount === validation.count;
        operatorSymbol = '=';
        break;
      case 'greaterThan':
        passed = actualCount > validation.count;
        operatorSymbol = '>';
        break;
      case 'lessThan':
        passed = actualCount < validation.count;
        operatorSymbol = '<';
        break;
      case 'greaterThanOrEqual':
        passed = actualCount >= validation.count;
        operatorSymbol = '>=';
        break;
      case 'lessThanOrEqual':
        passed = actualCount <= validation.count;
        operatorSymbol = '<=';
        break;
    }

    return {
      description: `Count of "${validation.selector}" should be ${operatorSymbol} ${validation.count}`,
      passed,
      expected: `${operatorSymbol} ${validation.count}`,
      actual: actualCount,
      error: passed ? undefined : `Expected count ${operatorSymbol} ${validation.count}, but got ${actualCount}`,
    };
  }

  // ============================================================================
  // Console Assertion Evaluators
  // ============================================================================

  /**
   * Evaluate maximum allowed errors.
   */
  private evaluateMaxErrors(errors: ConsoleLogEntry[], maxErrors: number): AssertionResult {
    const errorCount = errors.length;
    const passed = errorCount <= maxErrors;

    return {
      description: `Console should have at most ${maxErrors} error(s)`,
      passed,
      expected: `<= ${maxErrors} errors`,
      actual: `${errorCount} errors`,
      error: passed ? undefined : `Found ${errorCount} errors, but maximum allowed is ${maxErrors}`,
    };
  }

  /**
   * Evaluate maximum allowed warnings.
   */
  private evaluateMaxWarnings(warnings: ConsoleLogEntry[], maxWarnings: number): AssertionResult {
    const warningCount = warnings.length;
    const passed = warningCount <= maxWarnings;

    return {
      description: `Console should have at most ${maxWarnings} warning(s)`,
      passed,
      expected: `<= ${maxWarnings} warnings`,
      actual: `${warningCount} warnings`,
      error: passed ? undefined : `Found ${warningCount} warnings, but maximum allowed is ${maxWarnings}`,
    };
  }

  /**
   * Evaluate expected message existence.
   */
  private evaluateExpectedMessage(
    entries: ConsoleLogEntry[],
    expected: {
      level: 'log' | 'info' | 'warn' | 'error' | 'debug';
      text: string;
      match?: 'exact' | 'contains' | 'regex';
    }
  ): AssertionResult {
    const matchType = expected.match || 'contains';
    const levelEntries = entries.filter(e => e.level === expected.level);

    let found = false;
    let matchedMessage: string | undefined;

    for (const entry of levelEntries) {
      let isMatch = false;

      switch (matchType) {
        case 'exact':
          isMatch = entry.message === expected.text;
          break;
        case 'contains':
          isMatch = entry.message.includes(expected.text);
          break;
        case 'regex':
          try {
            const regex = new RegExp(expected.text);
            isMatch = regex.test(entry.message);
          } catch (error) {
            // Invalid regex, skip
          }
          break;
      }

      if (isMatch) {
        found = true;
        matchedMessage = entry.message;
        break;
      }
    }

    return {
      description: `Console should contain ${expected.level} message: "${expected.text}"`,
      passed: found,
      expected: expected.text,
      actual: matchedMessage || `No matching ${expected.level} message found`,
      error: found ? undefined : `Expected ${expected.level} message not found: "${expected.text}"`,
    };
  }

  /**
   * Evaluate forbidden message absence.
   */
  private evaluateForbiddenMessage(
    entries: ConsoleLogEntry[],
    forbidden: {
      level?: 'log' | 'info' | 'warn' | 'error' | 'debug';
      text: string;
      match?: 'exact' | 'contains' | 'regex';
    }
  ): AssertionResult {
    const matchType = forbidden.match || 'contains';
    const levelEntries = forbidden.level
      ? entries.filter(e => e.level === forbidden.level)
      : entries;

    let found = false;
    let matchedMessage: string | undefined;

    for (const entry of levelEntries) {
      let isMatch = false;

      switch (matchType) {
        case 'exact':
          isMatch = entry.message === forbidden.text;
          break;
        case 'contains':
          isMatch = entry.message.includes(forbidden.text);
          break;
        case 'regex':
          try {
            const regex = new RegExp(forbidden.text);
            isMatch = regex.test(entry.message);
          } catch (error) {
            // Invalid regex, skip
          }
          break;
      }

      if (isMatch) {
        found = true;
        matchedMessage = entry.message;
        break;
      }
    }

    const levelStr = forbidden.level ? `${forbidden.level} ` : '';

    return {
      description: `Console should not contain ${levelStr}message: "${forbidden.text}"`,
      passed: !found,
      expected: 'Message not found',
      actual: matchedMessage || 'No matching message found',
      error: found ? `Forbidden ${levelStr}message found: "${matchedMessage}"` : undefined,
    };
  }
}
