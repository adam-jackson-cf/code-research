import * as vscode from 'vscode';
import { logger } from './logger';

/**
 * Error types specific to this extension.
 */
export enum ErrorType {
  API_ERROR = 'API_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for extension-specific errors.
 */
export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType = ErrorType.UNKNOWN_ERROR,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * Error handler utility to centralize error handling logic.
 */
export class ErrorHandler {
  /**
   * Handles an error by logging it and optionally showing it to the user.
   */
  static handle(error: unknown, showToUser = false): void {
    const errorInfo = this.parseError(error);

    // Always log the error
    logger.error(errorInfo.message, errorInfo.originalError);

    // Optionally show to user
    if (showToUser) {
      this.showErrorToUser(errorInfo);
    }
  }

  /**
   * Handles an error and shows it to the user.
   */
  static handleAndShow(error: unknown): void {
    this.handle(error, true);
  }

  /**
   * Wraps an async function with error handling.
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    errorMessage: string,
    showToUser = false
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.handle(
        new ExtensionError(errorMessage, ErrorType.UNKNOWN_ERROR, error as Error),
        showToUser
      );
      return undefined;
    }
  }

  /**
   * Parses an unknown error into a structured format.
   */
  private static parseError(error: unknown): {
    message: string;
    type: ErrorType;
    originalError?: Error;
  } {
    if (error instanceof ExtensionError) {
      return {
        message: error.message,
        type: error.type,
        originalError: error.originalError,
      };
    }

    if (error instanceof Error) {
      // Try to determine error type from error message
      let type = ErrorType.UNKNOWN_ERROR;

      if (error.message.includes('network') || error.message.includes('fetch')) {
        type = ErrorType.NETWORK_ERROR;
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        type = ErrorType.PERMISSION_ERROR;
      } else if (error.message.includes('configuration') || error.message.includes('config')) {
        type = ErrorType.CONFIGURATION_ERROR;
      }

      return {
        message: error.message,
        type,
        originalError: error,
      };
    }

    // Unknown error type
    return {
      message: String(error),
      type: ErrorType.UNKNOWN_ERROR,
    };
  }

  /**
   * Shows an error message to the user with appropriate severity.
   */
  private static showErrorToUser(errorInfo: { message: string; type: ErrorType }): void {
    const actions: string[] = ['Show Logs'];

    const showError = () => {
      switch (errorInfo.type) {
        case ErrorType.PERMISSION_ERROR:
        case ErrorType.API_ERROR:
          return vscode.window.showErrorMessage(errorInfo.message, ...actions);

        case ErrorType.CONFIGURATION_ERROR:
          return vscode.window.showWarningMessage(errorInfo.message, ...actions);

        case ErrorType.NETWORK_ERROR:
          return vscode.window.showWarningMessage(
            `Network error: ${errorInfo.message}`,
            ...actions
          );

        default:
          return vscode.window.showErrorMessage(
            `Copilot Context Tracker: ${errorInfo.message}`,
            ...actions
          );
      }
    };

    showError().then((action) => {
      if (action === 'Show Logs') {
        logger.show();
      }
    });
  }

  /**
   * Creates a user-friendly error message.
   */
  static getUserFriendlyMessage(error: unknown): string {
    const errorInfo = this.parseError(error);

    switch (errorInfo.type) {
      case ErrorType.API_ERROR:
        return 'Failed to communicate with the Language Model API. Please check your Copilot connection.';

      case ErrorType.PERMISSION_ERROR:
        return 'Permission denied. Please ensure you have the necessary permissions to access Copilot features.';

      case ErrorType.NETWORK_ERROR:
        return 'Network error occurred. Please check your internet connection.';

      case ErrorType.CONFIGURATION_ERROR:
        return 'Configuration error. Please check your extension settings.';

      default:
        return errorInfo.message || 'An unexpected error occurred.';
    }
  }
}
