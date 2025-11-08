// Complete VS Code API mock for standalone unit tests

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }

  constructor(public readonly path: string) {}
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index > -1) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };
  }

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

export interface StatusBarItem {
  text: string;
  tooltip: string;
  command?: string;
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface OutputChannel {
  appendLine(value: string): void;
  append(value: string): void;
  clear(): void;
  dispose(): void;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Thenable<void>;
}

export interface ExtensionContext {
  subscriptions: Array<{ dispose(): void }>;
  workspaceState: Memento;
  globalState: Memento;
  extensionUri: Uri;
  extensionPath: string;
  storageUri?: Uri;
  globalStorageUri: Uri;
  logUri: Uri;
  storagePath?: string;
  globalStoragePath: string;
  logPath: string;
  asAbsolutePath(relativePath: string): string;
  extension: any;
  environmentVariableCollection: any;
  extensionMode: any;
  secrets: any;
  languageModelAccessInformation: any;
}

export interface LanguageModelChat {
  id: string;
  vendor: string;
  family: string;
  version: string;
  maxInputTokens: number;
  name: string;
  sendRequest(
    messages: LanguageModelChatMessage[],
    options?: any,
    token?: any
  ): any;
  countTokens(text: string | LanguageModelChatMessage, token?: any): Thenable<number>;
}

export class LanguageModelChatMessage {
  role: number;
  content: string;
  name?: string;

  static User(content: string, name?: string): LanguageModelChatMessage {
    const msg = new LanguageModelChatMessage(1, content);
    msg.name = name;
    return msg;
  }

  static Assistant(content: string, name?: string): LanguageModelChatMessage {
    const msg = new LanguageModelChatMessage(2, content);
    msg.name = name;
    return msg;
  }

  constructor(role: number, content: string) {
    this.role = role;
    this.content = content;
  }
}

export const window = {
  createStatusBarItem: (alignment?: StatusBarAlignment, priority?: number): StatusBarItem => {
    return {
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    };
  },
  createOutputChannel: (name: string): OutputChannel => {
    return {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
    };
  },
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    update: jest.fn(),
  })),
  onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
};

export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

const mockModels: LanguageModelChat[] = [
  {
    id: 'copilot-gpt-4o',
    vendor: 'copilot',
    family: 'gpt-4o',
    version: '1.0.0',
    maxInputTokens: 128000,
    name: 'GPT-4o',
    sendRequest: jest.fn(),
    countTokens: jest.fn(async () => 100),
  },
  {
    id: 'copilot-claude-sonnet',
    vendor: 'anthropic',
    family: 'claude-3.5-sonnet',
    version: '1.0.0',
    maxInputTokens: 200000,
    name: 'Claude 3.5 Sonnet',
    sendRequest: jest.fn(),
    countTokens: jest.fn(async () => 100),
  },
];

const onDidChangeChatModelsEmitter = new EventEmitter<any>();

export const lm = {
  selectChatModels: jest.fn(async () => mockModels),
  onDidChangeChatModels: onDidChangeChatModelsEmitter.event,
  _fireChatModelsChanged: () => onDidChangeChatModelsEmitter.fire({}),
};

// Helper for tests
export const _resetMocks = () => {
  jest.clearAllMocks();
  (lm.selectChatModels as jest.Mock).mockResolvedValue(mockModels);
};

export const _setMockModels = (models: LanguageModelChat[]) => {
  (lm.selectChatModels as jest.Mock).mockResolvedValue(models);
};
