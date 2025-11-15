/**
 * Checkpoint Manager
 *
 * Manages the lifecycle of checkpoints during test execution.
 * Creates CheckpointState objects with storage references and validates them.
 */

import type {
  CheckpointDefinition,
  CheckpointState,
  CheckpointRefs,
  StorageRef,
  TestConfig,
  ScreenshotOptions,
} from './types.js';
import type { ChromeDevToolsWrapper } from '../chrome/devtools-wrapper.js';
import type { StorageManager } from '../storage/index.js';
import type { CheckpointState as StorageCheckpointState } from '../storage/checkpoint-store.js';
import { CheckpointValidator } from '../validation/checkpoint-validator.js';

/**
 * Options for creating a checkpoint
 */
export interface CreateCheckpointOptions {
  testId: string;
  runId: string;
  checkpoint: CheckpointDefinition;
  testConfig: TestConfig;
}

/**
 * Checkpoint manager class
 */
export class CheckpointManager {
  private chrome: ChromeDevToolsWrapper;
  private storage: StorageManager;
  private validator: CheckpointValidator;

  constructor(
    chrome: ChromeDevToolsWrapper,
    storage: StorageManager
  ) {
    this.chrome = chrome;
    this.storage = storage;
    this.validator = new CheckpointValidator(storage);
  }

  /**
   * Create and capture a checkpoint
   */
  async createCheckpoint(
    options: CreateCheckpointOptions
  ): Promise<CheckpointState> {
    const startTime = Date.now();
    const { testId, runId, checkpoint } = options;

    try {
      // Initialize checkpoint state
      const state: CheckpointState = {
        checkpointId: checkpoint.id,
        testId,
        runId,
        timestamp: new Date().toISOString(),
        refs: {},
        status: 'passed',
        duration: 0,
      };

      // Capture artifacts based on checkpoint definition
      const refs = await this.captureArtifacts(checkpoint, testId, runId);
      state.refs = refs;

      // Run validations if defined
      if (checkpoint.validations) {
        const validationResults = await this.validator.validate(checkpoint, refs);

        state.validations = validationResults.validations;

        // Update status based on validation results
        const allPassed = validationResults.passed;
        state.status = allPassed ? 'passed' : 'failed';
      }

      // Calculate duration
      state.duration = Date.now() - startTime;

      return state;
    } catch (error) {
      throw new Error(
        `Failed to create checkpoint "${checkpoint.name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Capture artifacts based on checkpoint capture configuration
   */
  private async captureArtifacts(
    checkpoint: CheckpointDefinition,
    testId: string,
    runId: string
  ): Promise<CheckpointRefs> {
    const refs: CheckpointRefs = {};
    const { capture } = checkpoint;

    try {
      // Capture screenshot
      if (capture.screenshot) {
        const screenshotOptions: ScreenshotOptions =
          typeof capture.screenshot === 'boolean'
            ? {}
            : capture.screenshot;

        const screenshot = await this.chrome.captureScreenshot(screenshotOptions);

        // Convert base64 to buffer
        const buffer = Buffer.from(screenshot.data, 'base64');

        const ref = await this.storage.storeScreenshot(buffer, {
          testId,
          runId,
          checkpointId: checkpoint.id,
          timestamp: Date.now(),
        });

        refs.screenshot = ref;
      }

      // Capture HTML
      if (capture.html) {
        const domResult = await this.chrome.getDOM();
        const html = domResult.html;

        const ref = await this.storage.storeDOM(html, {
          testId,
          runId,
          checkpointId: checkpoint.id,
          url: domResult.url,
          timestamp: Date.now(),
        });

        refs.html = ref;
      }

      // Capture console logs
      if (capture.console) {
        const consoleLogs = await this.chrome.getConsoleLogs();

        const ref = await this.storage.storeConsoleLogs(
          consoleLogs as any, // Type compatibility
          {
            testId,
            runId,
            checkpointId: checkpoint.id,
            timestamp: Date.now(),
          }
        );

        refs.console = ref;
      }

      // Capture network (not implemented in chrome wrapper yet)
      if (capture.network) {
        // Placeholder for network capture
        // This would require additional implementation in ChromeDevToolsWrapper
      }

      // Capture performance (not implemented in chrome wrapper yet)
      if (capture.performance) {
        // Placeholder for performance capture
        // This would require additional implementation in ChromeDevToolsWrapper
      }

      return refs;
    } catch (error) {
      throw new Error(
        `Failed to capture artifacts: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieve a checkpoint by its storage reference
   */
  async retrieveCheckpoint(ref: StorageRef): Promise<CheckpointState> {
    try {
      return await this.storage.retrieveCheckpoint(ref) as any as CheckpointState;
    } catch (error) {
      throw new Error(
        `Failed to retrieve checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Update a checkpoint
   */
  async updateCheckpoint(
    ref: StorageRef,
    updates: Partial<CheckpointState>
  ): Promise<void> {
    try {
      // Convert core CheckpointState updates to storage format
      await this.storage.updateCheckpoint(ref, updates as any as Partial<StorageCheckpointState>);
    } catch (error) {
      throw new Error(
        `Failed to update checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get checkpoint by name
   */
  async getCheckpointByName(name: string): Promise<StorageRef | null> {
    try {
      return await this.storage.getCheckpointByName(name);
    } catch (error) {
      throw new Error(
        `Failed to get checkpoint by name: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Compare two checkpoints
   */
  async compareCheckpoints(
    ref1: StorageRef,
    ref2: StorageRef
  ): Promise<any> {
    try {
      return await this.storage.compareCheckpoints(ref1, ref2);
    } catch (error) {
      throw new Error(
        `Failed to compare checkpoints: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
