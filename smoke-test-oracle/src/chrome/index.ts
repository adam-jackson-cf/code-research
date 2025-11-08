/**
 * Chrome DevTools MCP Wrapper
 *
 * Main export file for all Chrome DevTools functionality
 */

// Main wrapper class
export { ChromeDevToolsWrapper } from './devtools-wrapper.js';

// Navigation utilities
export {
  navigateWithRetry,
  waitForNavigation,
  goBack,
  goForward,
  reload,
} from './navigation.js';

// Console utilities
export {
  extractConsoleLogs,
  clearBrowserConsole,
  filterConsoleLogs,
  getErrorLogs,
  getWarningLogs,
  hasConsoleErrors,
} from './console-reader.js';

// Screenshot utilities
export {
  captureScreenshot,
  captureScreenshotWithRetry,
  captureElementScreenshot,
  screenshotToBase64,
  getRawBase64,
} from './screenshot-capture.js';

// DOM utilities
export {
  extractDOM,
  querySelectorInDOM,
  querySelectorAllInDOM,
  getElementText,
  getInputValue,
  getElementAttribute,
  elementExists,
  countElements,
  extractElementInfo,
  extractLinks,
  extractImages,
  getPageText,
} from './dom-extractor.js';
