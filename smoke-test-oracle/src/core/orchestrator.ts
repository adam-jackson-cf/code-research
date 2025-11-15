/**
 * Test Orchestrator
 *
 * Main orchestrator that coordinates test execution.
 * Manages ChromeDevToolsWrapper, StorageManager, and CheckpointManager.
 * Executes test steps in sequence and captures data at checkpoints.
 */

import { randomUUID } from 'crypto';
import type {
  TestDefinition,
  TestResult,
  TestStep,
  CheckpointStep,
  CheckpointState,
  StorageRef,
} from './types.js';
import { ChromeDevToolsWrapper } from '../chrome/devtools-wrapper.js';
import { StorageManager } from '../storage/index.js';
import { CheckpointManager } from './checkpoint-manager.js';
import { TestRunner } from './test-runner.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  chrome: ChromeDevToolsWrapper;
  storage: StorageManager;
  baseDir?: string;
}

/**
 * Test execution context
 */
interface ExecutionContext {
  testId: string;
  runId: string;
  testDefinition: TestDefinition;
  checkpoints: CheckpointState[];
  artifacts: StorageRef[];
  startTime: string;
}

/**
 * Main test orchestrator class
 */
export class TestOrchestrator {
  private chrome: ChromeDevToolsWrapper;
  private storage: StorageManager;
  private checkpointManager: CheckpointManager;
  private testRunner: TestRunner;

  constructor(config: OrchestratorConfig) {
    this.chrome = config.chrome;
    this.storage = config.storage;
    this.checkpointManager = new CheckpointManager(this.chrome, this.storage);
    this.testRunner = new TestRunner(this.chrome);
  }

  /**
   * Execute a test definition
   */
  async execute(testDefinition: TestDefinition): Promise<TestResult> {
    const runId = randomUUID();
    const startTime = new Date().toISOString();

    const context: ExecutionContext = {
      testId: testDefinition.id,
      runId,
      testDefinition,
      checkpoints: [],
      artifacts: [],
      startTime,
    };

    try {
      // Initialize storage
      await this.storage.initialize();

      // Execute beforeAll steps if defined
      if (testDefinition.beforeAll && testDefinition.beforeAll.length > 0) {
        await this.executeSteps(testDefinition.beforeAll, context);
      }

      // Execute main test steps
      await this.executeSteps(testDefinition.steps, context);

      // Execute afterAll steps if defined
      if (testDefinition.afterAll && testDefinition.afterAll.length > 0) {
        await this.executeSteps(testDefinition.afterAll, context);
      }

      // Determine overall status
      const hasFailedCheckpoints = context.checkpoints.some(
        cp => cp.status === 'failed'
      );

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      const result: TestResult = {
        testId: testDefinition.id,
        runId,
        status: hasFailedCheckpoints ? 'failed' : 'passed',
        startTime,
        endTime,
        duration,
        checkpoints: context.checkpoints,
        artifacts: context.artifacts,
      };

      return result;
    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      const result: TestResult = {
        testId: testDefinition.id,
        runId,
        status: 'error',
        startTime,
        endTime,
        duration,
        checkpoints: context.checkpoints,
        artifacts: context.artifacts,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };

      return result;
    }
  }

  /**
   * Execute a list of test steps
   */
  private async executeSteps(
    steps: TestStep[],
    context: ExecutionContext
  ): Promise<void> {
    for (const step of steps) {
      // Check if this is a checkpoint step
      if (step.action === 'checkpoint') {
        await this.executeCheckpoint(step as CheckpointStep, context);
      } else {
        // Execute regular step
        const result = await this.testRunner.executeStep(step);

        if (!result.success) {
          throw new Error(
            `Step "${step.id}" failed: ${result.error?.message || 'Unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Execute a checkpoint step
   */
  private async executeCheckpoint(
    step: CheckpointStep,
    context: ExecutionContext
  ): Promise<void> {
    try {
      const checkpointState = await this.checkpointManager.createCheckpoint({
        testId: context.testId,
        runId: context.runId,
        checkpoint: step.checkpoint,
        testConfig: context.testDefinition,
      });

      // Add checkpoint to context
      context.checkpoints.push(checkpointState);

      // Add checkpoint artifacts to overall artifacts
      if (checkpointState.refs.screenshot) {
        context.artifacts.push(checkpointState.refs.screenshot);
      }
      if (checkpointState.refs.html) {
        context.artifacts.push(checkpointState.refs.html);
      }
      if (checkpointState.refs.console) {
        context.artifacts.push(checkpointState.refs.console);
      }
      if (checkpointState.refs.network) {
        context.artifacts.push(checkpointState.refs.network);
      }
      if (checkpointState.refs.performance) {
        context.artifacts.push(checkpointState.refs.performance);
      }

      // If checkpoint failed, optionally fail the test
      if (checkpointState.status === 'failed') {
        const failedValidations = checkpointState.validations?.filter(v => !v.passed) || [];
        const failureMessages = failedValidations.map(v => v.message).join(', ');

        throw new Error(
          `Checkpoint "${step.checkpoint.name}" failed: ${failureMessages}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to execute checkpoint "${step.checkpoint.name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get the Chrome DevTools wrapper
   */
  getChrome(): ChromeDevToolsWrapper {
    return this.chrome;
  }

  /**
   * Get the storage manager
   */
  getStorage(): StorageManager {
    return this.storage;
  }

  /**
   * Get the checkpoint manager
   */
  getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.chrome.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
