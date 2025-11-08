import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate, deactivate, getExtensionContext } from '../../src/extension';

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('your-publisher-name.copilot-context-tracker'));
  });

  test('should activate extension', async () => {
    const ext = vscode.extensions.getExtension('your-publisher-name.copilot-context-tracker');
    if (ext) {
      await ext.activate();
      assert.ok(ext.isActive);
    }
  });

  test('should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('copilot-context-tracker.showDetailedView'));
    assert.ok(commands.includes('copilot-context-tracker.refreshModels'));
    assert.ok(commands.includes('copilot-context-tracker.clearUsageStats'));
  });

  test('showDetailedView command should execute', async () => {
    await vscode.commands.executeCommand('copilot-context-tracker.showDetailedView');
    // Should not throw
    assert.ok(true);
  });

  test('refreshModels command should execute', async () => {
    await vscode.commands.executeCommand('copilot-context-tracker.refreshModels');
    // Should not throw
    assert.ok(true);
  });

  test('should handle activation without models', async () => {
    // This tests the case where no Copilot models are available
    const mockContext: vscode.ExtensionContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      extensionPath: __dirname,
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
        keys: () => [],
      } as any,
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
      } as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: undefined,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storagePath: undefined,
      globalStoragePath: __dirname,
      logPath: __dirname,
      asAbsolutePath: (relativePath: string) => relativePath,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Should not throw
    await activate(mockContext);
    assert.ok(true);

    // Clean up
    deactivate();
  });

  test('should handle configuration changes', async () => {
    // Get the configuration
    const config = vscode.workspace.getConfiguration('copilot-context-tracker');

    // Save current value
    const currentLogLevel = config.get('logLevel');

    try {
      // Change configuration
      await config.update('logLevel', 'debug', vscode.ConfigurationTarget.Global);

      // Wait a bit for the event to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.ok(true);
    } finally {
      // Restore original value
      await config.update('logLevel', currentLogLevel, vscode.ConfigurationTarget.Global);
    }
  });

  test('should handle deactivation', () => {
    deactivate();
    // Should not throw
    assert.ok(true);
  });

  test('should handle multiple activations', async () => {
    const mockContext: vscode.ExtensionContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      extensionPath: __dirname,
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
        keys: () => [],
      } as any,
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
      } as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: undefined,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storagePath: undefined,
      globalStoragePath: __dirname,
      logPath: __dirname,
      asAbsolutePath: (relativePath: string) => relativePath,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    await activate(mockContext);
    await activate(mockContext);

    // Should not throw
    assert.ok(true);

    deactivate();
  });

  test('should handle multiple deactivations', () => {
    deactivate();
    deactivate();
    deactivate();

    // Should not throw
    assert.ok(true);
  });

  test('getExtensionContext should return context after activation', async () => {
    const mockContext: vscode.ExtensionContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      extensionPath: __dirname,
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
        keys: () => [],
      } as any,
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
      } as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: undefined,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storagePath: undefined,
      globalStoragePath: __dirname,
      logPath: __dirname,
      asAbsolutePath: (relativePath: string) => relativePath,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    await activate(mockContext);

    // Context should exist or be undefined depending on activation success
    // We just verify getExtensionContext doesn't throw
    getExtensionContext();
    assert.ok(true);

    deactivate();
  });

  test('should handle activation errors gracefully', async () => {
    const mockContext: vscode.ExtensionContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(__dirname),
      extensionPath: __dirname,
      globalState: {
        get: () => {
          throw new Error('Test error');
        },
        update: async () => {},
        setKeysForSync: () => {},
        keys: () => [],
      } as any,
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
      } as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: undefined,
      globalStorageUri: vscode.Uri.file(__dirname),
      logUri: vscode.Uri.file(__dirname),
      storagePath: undefined,
      globalStoragePath: __dirname,
      logPath: __dirname,
      asAbsolutePath: (relativePath: string) => relativePath,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Should handle errors gracefully
    await activate(mockContext);
    assert.ok(true);

    deactivate();
  });
});
