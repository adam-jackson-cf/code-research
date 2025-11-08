import * as vscode from 'vscode';

/**
 * Log levels for the logger.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Simple logger utility for the extension.
 * Logs to VS Code output channel and supports different log levels.
 */
export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Copilot Context Tracker');
  }

  /**
   * Gets the singleton logger instance.
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Sets the log level from configuration.
   */
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };

    this.logLevel = levelMap[level] || LogLevel.INFO;
    this.info(`Log level set to: ${level}`);
  }

  /**
   * Logs a debug message.
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Logs an info message.
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Logs a warning message.
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Logs an error message.
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, `${message}: ${error.message}`, error.stack, ...args);
    } else {
      this.log(LogLevel.ERROR, message, error, ...args);
    }
  }

  /**
   * Shows the output channel to the user.
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Internal log method that formats and writes to output channel.
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

    this.outputChannel.appendLine(formattedMessage);

    if (args.length > 0) {
      args.forEach((arg) => {
        if (typeof arg === 'string') {
          this.outputChannel.appendLine(`  ${arg}`);
        } else {
          this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
        }
      });
    }
  }

  /**
   * Disposes the output channel.
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export a singleton instance for convenience
export const logger = Logger.getInstance();
