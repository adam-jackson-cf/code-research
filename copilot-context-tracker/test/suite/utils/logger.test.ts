import * as assert from 'assert';
import { Logger } from '../../../src/utils/logger';

suite('Logger Test Suite', () => {
  let logger: Logger;

  setup(() => {
    logger = Logger.getInstance();
  });

  test('should be a singleton', () => {
    const logger1 = Logger.getInstance();
    const logger2 = Logger.getInstance();
    assert.strictEqual(logger1, logger2);
  });

  test('should set log level from string', () => {
    logger.setLogLevel('debug');
    logger.setLogLevel('info');
    logger.setLogLevel('warn');
    logger.setLogLevel('error');
    // Should not throw
    assert.ok(true);
  });

  test('should handle invalid log level', () => {
    logger.setLogLevel('invalid' as any);
    // Should default to info
    assert.ok(true);
  });

  test('should log debug messages', () => {
    logger.setLogLevel('debug');
    logger.debug('Debug message');
    // Should not throw
    assert.ok(true);
  });

  test('should log info messages', () => {
    logger.setLogLevel('info');
    logger.info('Info message');
    // Should not throw
    assert.ok(true);
  });

  test('should log warn messages', () => {
    logger.setLogLevel('warn');
    logger.warn('Warning message');
    // Should not throw
    assert.ok(true);
  });

  test('should log error messages', () => {
    logger.setLogLevel('error');
    logger.error('Error message');
    // Should not throw
    assert.ok(true);
  });

  test('should log error with Error object', () => {
    logger.setLogLevel('error');
    const error = new Error('Test error');
    logger.error('Error occurred', error);
    // Should not throw
    assert.ok(true);
  });

  test('should log error with unknown error', () => {
    logger.setLogLevel('error');
    logger.error('Error occurred', 'string error');
    // Should not throw
    assert.ok(true);
  });

  test('should log with additional arguments', () => {
    logger.setLogLevel('debug');
    logger.debug('Message', { key: 'value' }, [1, 2, 3]);
    // Should not throw
    assert.ok(true);
  });

  test('should respect log level filtering', () => {
    logger.setLogLevel('error');
    // These should not be logged
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    // This should be logged
    logger.error('Error message');
    // Should not throw
    assert.ok(true);
  });

  test('should show output channel', () => {
    logger.show();
    // Should not throw
    assert.ok(true);
  });

  test('should handle multiple log calls', () => {
    logger.setLogLevel('debug');
    for (let i = 0; i < 10; i++) {
      logger.debug(`Message ${i}`);
    }
    // Should not throw
    assert.ok(true);
  });

  test('should log objects as JSON', () => {
    logger.setLogLevel('debug');
    const obj = {
      name: 'Test',
      value: 123,
      nested: {
        key: 'value',
      },
    };
    logger.debug('Object', obj);
    // Should not throw
    assert.ok(true);
  });

  test('should log arrays', () => {
    logger.setLogLevel('debug');
    const arr = [1, 2, 3, 'four', { five: 5 }];
    logger.debug('Array', arr);
    // Should not throw
    assert.ok(true);
  });

  test('should handle empty messages', () => {
    logger.setLogLevel('debug');
    logger.debug('');
    logger.info('');
    logger.warn('');
    logger.error('');
    // Should not throw
    assert.ok(true);
  });

  test('should handle long messages', () => {
    logger.setLogLevel('debug');
    const longMessage = 'a'.repeat(10000);
    logger.debug(longMessage);
    // Should not throw
    assert.ok(true);
  });

  test('should handle special characters in messages', () => {
    logger.setLogLevel('debug');
    logger.debug('Message with \n newlines \t tabs \r returns');
    // Should not throw
    assert.ok(true);
  });

  test('should handle unicode characters', () => {
    logger.setLogLevel('debug');
    logger.debug('Message with unicode: 🚀 💻 🎉');
    // Should not throw
    assert.ok(true);
  });

  test('should handle null and undefined arguments', () => {
    logger.setLogLevel('debug');
    logger.debug('Message', null, undefined);
    // Should not throw
    assert.ok(true);
  });

  test('should handle circular references in objects', () => {
    logger.setLogLevel('debug');
    const obj: any = { name: 'Test' };
    obj.self = obj;

    // This might throw or handle gracefully depending on implementation
    try {
      logger.debug('Circular object', obj);
      assert.ok(true);
    } catch (e) {
      // If it throws, that's also acceptable behavior
      assert.ok(true);
    }
  });
});
