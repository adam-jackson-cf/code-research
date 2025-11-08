import {
  CheckpointDefinition,
  CheckpointRefs,
  ValidationResult,
  AssertionResult,
  VisualValidations,
  StorageRef,
} from '../core/types.js';
import { StorageManager } from '../storage/index.js';
import { AssertionEngine } from './assertion-engine.js';

/**
 * Result of checkpoint validation.
 */
export interface CheckpointValidationResult {
  /** Whether all validations passed */
  passed: boolean;
  /** Individual validation results */
  validations: ValidationResult[];
  /** Overall duration in milliseconds */
  duration: number;
  /** Summary message */
  summary: string;
}

/**
 * Checkpoint validator that orchestrates all validation types.
 * Uses progressive disclosure to avoid loading all data into memory.
 */
export class CheckpointValidator {
  private assertionEngine: AssertionEngine;

  constructor(private storage: StorageManager) {
    this.assertionEngine = new AssertionEngine(storage);
  }

  /**
   * Validate a checkpoint against its definition.
   * Only loads data from storage as needed for each validation type.
   *
   * @param definition - Checkpoint definition with validation rules
   * @param refs - References to captured checkpoint data
   * @returns Validation result
   */
  async validate(
    definition: CheckpointDefinition,
    refs: CheckpointRefs
  ): Promise<CheckpointValidationResult> {
    const startTime = Date.now();
    const validations: ValidationResult[] = [];

    // Validate DOM if specified
    if (definition.validations?.dom) {
      const domResult = await this.validateDOM(definition, refs);
      validations.push(domResult);
    }

    // Validate console if specified
    if (definition.validations?.console) {
      const consoleResult = await this.validateConsole(definition, refs);
      validations.push(consoleResult);
    }

    // Validate visual if specified
    if (definition.validations?.visual) {
      const visualResult = await this.validateVisual(definition, refs);
      validations.push(visualResult);
    }

    // Validate custom validations if specified
    if (definition.validations?.custom) {
      for (const customValidation of definition.validations.custom) {
        const customResult = await this.validateCustom(customValidation, refs);
        validations.push(customResult);
      }
    }

    // Determine overall result
    const allPassed = validations.every(v => v.passed);
    const duration = Date.now() - startTime;

    // Generate summary
    const summary = this.generateSummary(validations, allPassed);

    return {
      passed: allPassed,
      validations,
      duration,
      summary,
    };
  }

  /**
   * Validate DOM assertions.
   *
   * @param definition - Checkpoint definition
   * @param refs - Checkpoint references
   * @returns Validation result
   */
  private async validateDOM(
    definition: CheckpointDefinition,
    refs: CheckpointRefs
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      if (!definition.validations?.dom) {
        return {
          type: 'dom',
          name: 'DOM Validation',
          passed: true,
          message: 'No DOM validations specified',
          assertions: [],
          duration: 0,
        };
      }

      // Use assertion engine to evaluate DOM validations
      // This will query the storage manager for DOM data as needed
      const assertions = await this.assertionEngine.evaluateDOMValidations(
        definition.validations.dom,
        refs.html
      );

      const allPassed = assertions.every(a => a.passed);
      const failedCount = assertions.filter(a => !a.passed).length;

      let message = `DOM validation ${allPassed ? 'passed' : 'failed'}`;
      if (!allPassed) {
        message += `: ${failedCount} of ${assertions.length} assertions failed`;
      } else {
        message += `: all ${assertions.length} assertions passed`;
      }

      return {
        type: 'dom',
        name: 'DOM Validation',
        passed: allPassed,
        message,
        assertions,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        type: 'dom',
        name: 'DOM Validation',
        passed: false,
        message: `DOM validation error: ${error}`,
        assertions: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate console assertions.
   *
   * @param definition - Checkpoint definition
   * @param refs - Checkpoint references
   * @returns Validation result
   */
  private async validateConsole(
    definition: CheckpointDefinition,
    refs: CheckpointRefs
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      if (!definition.validations?.console) {
        return {
          type: 'console',
          name: 'Console Validation',
          passed: true,
          message: 'No console validations specified',
          assertions: [],
          duration: 0,
        };
      }

      // Use assertion engine to evaluate console validations
      // This will query the storage manager for console data as needed
      const assertions = await this.assertionEngine.evaluateConsoleValidations(
        definition.validations.console,
        refs.console
      );

      const allPassed = assertions.every(a => a.passed);
      const failedCount = assertions.filter(a => !a.passed).length;

      let message = `Console validation ${allPassed ? 'passed' : 'failed'}`;
      if (!allPassed) {
        message += `: ${failedCount} of ${assertions.length} assertions failed`;
      } else {
        message += `: all ${assertions.length} assertions passed`;
      }

      return {
        type: 'console',
        name: 'Console Validation',
        passed: allPassed,
        message,
        assertions,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        type: 'console',
        name: 'Console Validation',
        passed: false,
        message: `Console validation error: ${error}`,
        assertions: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate visual assertions.
   *
   * @param definition - Checkpoint definition
   * @param refs - Checkpoint references
   * @returns Validation result
   */
  private async validateVisual(
    definition: CheckpointDefinition,
    refs: CheckpointRefs
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      if (!definition.validations?.visual) {
        return {
          type: 'visual',
          name: 'Visual Validation',
          passed: true,
          message: 'No visual validations specified',
          assertions: [],
          duration: 0,
        };
      }

      const visualValidations = definition.validations.visual;
      const assertions: AssertionResult[] = [];

      // Check if we have a screenshot to validate
      if (!refs.screenshot) {
        return {
          type: 'visual',
          name: 'Visual Validation',
          passed: false,
          message: 'Visual validation failed: no screenshot available',
          assertions: [{
            description: 'Screenshot availability',
            passed: false,
            error: 'No screenshot captured for visual validation',
          }],
          duration: Date.now() - startTime,
        };
      }

      // Perform visual comparison if baseline is specified
      if (visualValidations.baseline) {
        const baselineRef = this.resolveBaselineRef(visualValidations.baseline);

        if (baselineRef) {
          const comparisonResult = await this.compareScreenshots(
            refs.screenshot,
            baselineRef,
            visualValidations
          );
          assertions.push(comparisonResult);
        } else {
          assertions.push({
            description: 'Visual comparison with baseline',
            passed: false,
            error: 'Baseline screenshot not found or invalid',
          });
        }
      }

      const allPassed = assertions.every(a => a.passed);
      const failedCount = assertions.filter(a => !a.passed).length;

      let message = `Visual validation ${allPassed ? 'passed' : 'failed'}`;
      if (assertions.length > 0) {
        if (!allPassed) {
          message += `: ${failedCount} of ${assertions.length} assertions failed`;
        } else {
          message += `: all ${assertions.length} assertions passed`;
        }
      }

      return {
        type: 'visual',
        name: 'Visual Validation',
        passed: allPassed,
        message,
        assertions,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        type: 'visual',
        name: 'Visual Validation',
        passed: false,
        message: `Visual validation error: ${error}`,
        assertions: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate custom assertions.
   *
   * @param customValidation - Custom validation function
   * @param refs - Checkpoint references
   * @returns Validation result
   */
  private async validateCustom(
    customValidation: {
      name: string;
      fn: string;
      args?: any[];
    },
    refs: CheckpointRefs
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Custom validation function should be a string that can be evaluated
      // For security reasons, this is simplified - in production, use a safer approach
      const fn = new Function('refs', 'args', customValidation.fn);
      const result = await fn(refs, customValidation.args || []);

      // Result should be an AssertionResult or boolean
      let assertions: AssertionResult[];
      if (typeof result === 'boolean') {
        assertions = [{
          description: customValidation.name,
          passed: result,
          expected: 'Validation passes',
          actual: result ? 'Passed' : 'Failed',
        }];
      } else if (Array.isArray(result)) {
        assertions = result;
      } else {
        assertions = [result];
      }

      const allPassed = assertions.every(a => a.passed);

      return {
        type: 'custom',
        name: customValidation.name,
        passed: allPassed,
        message: `Custom validation "${customValidation.name}" ${allPassed ? 'passed' : 'failed'}`,
        assertions,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        type: 'custom',
        name: customValidation.name,
        passed: false,
        message: `Custom validation error: ${error}`,
        assertions: [{
          description: customValidation.name,
          passed: false,
          error: `Failed to execute custom validation: ${error}`,
        }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compare two screenshots for visual validation.
   *
   * @param currentRef - Current screenshot reference
   * @param baselineRef - Baseline screenshot reference
   * @param validations - Visual validation options
   * @returns Assertion result
   */
  private async compareScreenshots(
    currentRef: StorageRef,
    baselineRef: StorageRef,
    validations: VisualValidations
  ): Promise<AssertionResult> {
    try {
      const threshold = validations.threshold || 0.1; // Default 10% difference allowed

      // Use storage manager to compare screenshots
      const comparisonResult = await this.storage.compareScreenshots(
        currentRef,
        baselineRef,
        {
          threshold,
          includeAA: true,
        }
      );

      const passed = comparisonResult.diffPercentage <= (threshold * 100);

      return {
        description: 'Visual comparison with baseline',
        passed,
        expected: `<= ${threshold * 100}% difference`,
        actual: `${comparisonResult.diffPercentage.toFixed(2)}% difference`,
        error: passed
          ? undefined
          : `Screenshot difference (${comparisonResult.diffPercentage.toFixed(2)}%) exceeds threshold (${threshold * 100}%)`,
      };
    } catch (error) {
      return {
        description: 'Visual comparison with baseline',
        passed: false,
        error: `Failed to compare screenshots: ${error}`,
      };
    }
  }

  /**
   * Resolve baseline reference from string or StorageRef.
   *
   * @param baseline - Baseline identifier (string path or StorageRef)
   * @returns StorageRef or null if not found
   */
  private resolveBaselineRef(baseline: StorageRef | string): StorageRef | null {
    if (typeof baseline === 'string') {
      // If string, it could be a checkpoint name - try to resolve it
      // For now, return null as we'd need to query the storage
      // In a full implementation, we'd query the checkpoint store by name
      return null;
    }
    return baseline;
  }

  /**
   * Generate summary message from validation results.
   *
   * @param validations - Validation results
   * @param allPassed - Whether all validations passed
   * @returns Summary message
   */
  private generateSummary(validations: ValidationResult[], allPassed: boolean): string {
    const total = validations.length;
    const passed = validations.filter(v => v.passed).length;
    const failed = total - passed;

    if (allPassed) {
      return `All ${total} validation(s) passed`;
    } else {
      const failedTypes = validations
        .filter(v => !v.passed)
        .map(v => v.type)
        .join(', ');
      return `${failed} of ${total} validation(s) failed (${failedTypes})`;
    }
  }

  /**
   * Get detailed validation report.
   *
   * @param result - Validation result
   * @returns Formatted report string
   */
  getDetailedReport(result: CheckpointValidationResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('CHECKPOINT VALIDATION REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Overall Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`Summary: ${result.summary}`);
    lines.push('');

    for (const validation of result.validations) {
      lines.push('-'.repeat(80));
      lines.push(`${validation.name} [${validation.type.toUpperCase()}]`);
      lines.push(`Status: ${validation.passed ? 'PASSED' : 'FAILED'}`);
      lines.push(`Message: ${validation.message}`);
      lines.push(`Duration: ${validation.duration}ms`);

      if (validation.assertions && validation.assertions.length > 0) {
        lines.push('');
        lines.push('Assertions:');
        for (const assertion of validation.assertions) {
          const status = assertion.passed ? '✓' : '✗';
          lines.push(`  ${status} ${assertion.description}`);
          if (!assertion.passed && assertion.error) {
            lines.push(`    Error: ${assertion.error}`);
          }
          if (assertion.expected !== undefined) {
            lines.push(`    Expected: ${assertion.expected}`);
            lines.push(`    Actual: ${assertion.actual}`);
          }
        }
      }
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
