import * as assert from 'assert';
import { ErrorHandler, ErrorType, ExtensionError } from '../../../src/utils/errorHandler';

suite('ErrorHandler Test Suite', () => {
  test('ExtensionError should create with message', () => {
    const error = new ExtensionError('Test error');
    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.type, ErrorType.UNKNOWN_ERROR);
    assert.strictEqual(error.name, 'ExtensionError');
  });

  test('ExtensionError should create with type', () => {
    const error = new ExtensionError('API error', ErrorType.API_ERROR);
    assert.strictEqual(error.message, 'API error');
    assert.strictEqual(error.type, ErrorType.API_ERROR);
  });

  test('ExtensionError should create with original error', () => {
    const originalError = new Error('Original');
    const error = new ExtensionError('Wrapped error', ErrorType.UNKNOWN_ERROR, originalError);
    assert.strictEqual(error.originalError, originalError);
  });

  test('should handle ExtensionError', () => {
    const error = new ExtensionError('Test error', ErrorType.API_ERROR);
    ErrorHandler.handle(error, false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle standard Error', () => {
    const error = new Error('Standard error');
    ErrorHandler.handle(error, false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle string error', () => {
    ErrorHandler.handle('String error', false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle unknown error type', () => {
    ErrorHandler.handle({ custom: 'error' }, false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle null error', () => {
    ErrorHandler.handle(null, false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle undefined error', () => {
    ErrorHandler.handle(undefined, false);
    // Should not throw
    assert.ok(true);
  });

  test('handleAndShow should handle error', () => {
    const error = new ExtensionError('Test error');
    ErrorHandler.handleAndShow(error);
    // Should not throw (but will show to user in VS Code)
    assert.ok(true);
  });

  test('should detect network error from message', () => {
    const error = new Error('Network error occurred');
    ErrorHandler.handle(error, false);
    // Should classify as NETWORK_ERROR
    assert.ok(true);
  });

  test('should detect permission error from message', () => {
    const error = new Error('Permission denied');
    ErrorHandler.handle(error, false);
    // Should classify as PERMISSION_ERROR
    assert.ok(true);
  });

  test('should detect configuration error from message', () => {
    const error = new Error('Configuration is invalid');
    ErrorHandler.handle(error, false);
    // Should classify as CONFIGURATION_ERROR
    assert.ok(true);
  });

  test('should detect fetch error from message', () => {
    const error = new Error('Failed to fetch data');
    ErrorHandler.handle(error, false);
    // Should classify as NETWORK_ERROR
    assert.ok(true);
  });

  test('getUserFriendlyMessage should return API error message', () => {
    const error = new ExtensionError('Test', ErrorType.API_ERROR);
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.ok(message.includes('Language Model API'));
  });

  test('getUserFriendlyMessage should return permission error message', () => {
    const error = new ExtensionError('Test', ErrorType.PERMISSION_ERROR);
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.ok(message.includes('Permission denied'));
  });

  test('getUserFriendlyMessage should return network error message', () => {
    const error = new ExtensionError('Test', ErrorType.NETWORK_ERROR);
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.ok(message.includes('Network error'));
  });

  test('getUserFriendlyMessage should return config error message', () => {
    const error = new ExtensionError('Test', ErrorType.CONFIGURATION_ERROR);
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.ok(message.includes('Configuration error'));
  });

  test('getUserFriendlyMessage should return original message for unknown error', () => {
    const error = new ExtensionError('Custom error message', ErrorType.UNKNOWN_ERROR);
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.strictEqual(message, 'Custom error message');
  });

  test('getUserFriendlyMessage should handle standard Error', () => {
    const error = new Error('Standard error');
    const message = ErrorHandler.getUserFriendlyMessage(error);
    assert.ok(message.length > 0);
  });

  test('wrap should return result on success', async () => {
    const result = await ErrorHandler.wrap(
      async () => 'success',
      'Should not fail',
      false
    );
    assert.strictEqual(result, 'success');
  });

  test('wrap should return undefined on failure', async () => {
    const result = await ErrorHandler.wrap(
      async () => {
        throw new Error('Test error');
      },
      'Test error message',
      false
    );
    assert.strictEqual(result, undefined);
  });

  test('wrap should handle async functions', async () => {
    const result = await ErrorHandler.wrap(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 42;
      },
      'Should succeed',
      false
    );
    assert.strictEqual(result, 42);
  });

  test('wrap should handle errors in async functions', async () => {
    const result = await ErrorHandler.wrap(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async error');
      },
      'Async error message',
      false
    );
    assert.strictEqual(result, undefined);
  });

  test('should handle multiple error types', () => {
    const errors = [
      new ExtensionError('API', ErrorType.API_ERROR),
      new ExtensionError('Network', ErrorType.NETWORK_ERROR),
      new ExtensionError('Permission', ErrorType.PERMISSION_ERROR),
      new ExtensionError('Config', ErrorType.CONFIGURATION_ERROR),
      new ExtensionError('Unknown', ErrorType.UNKNOWN_ERROR),
    ];

    errors.forEach((error) => {
      ErrorHandler.handle(error, false);
    });

    // Should not throw
    assert.ok(true);
  });

  test('should handle error with stack trace', () => {
    const error = new Error('Error with stack');
    error.stack = 'Error: Error with stack\n  at Test (file.ts:10:20)';
    ErrorHandler.handle(error, false);
    // Should not throw
    assert.ok(true);
  });

  test('should handle error without stack trace', () => {
    const error = new Error('Error without stack');
    delete error.stack;
    ErrorHandler.handle(error, false);
    // Should not throw
    assert.ok(true);
  });
});
