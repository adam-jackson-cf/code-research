/**
 * Basic Test Example
 *
 * Demonstrates how to use the fluent test builder API
 * to create and execute smoke tests.
 */

import { TestBuilder } from '../src/api/index.js';
import { ChromeDevToolsWrapper } from '../src/chrome/index.js';
import { StorageManager } from '../src/storage/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * Example: Basic smoke test for a login flow
 */
async function basicLoginTest() {
  // Set up Chrome DevTools client (you would initialize this with actual MCP client)
  const mcpClient = {} as Client; // Placeholder
  const chrome = new ChromeDevToolsWrapper(mcpClient);

  // Set up storage manager
  const storage = new StorageManager({
    baseDir: './test-storage',
  });

  // Build the test using fluent API
  const test = TestBuilder.create('Login Flow Test')
    .description('Validates the user login functionality')
    .tags('smoke', 'auth', 'critical')
    .timeout(30000)
    .viewport({ width: 1280, height: 720 })

    // Navigate to login page
    .navigate('https://example.com/login')

    // Wait for login form to appear
    .wait('#login-form', { visible: true })

    // Create checkpoint - validate initial state
    .checkpoint('login-page-loaded', {
      description: 'Login page fully loaded',
      capture: {
        screenshot: true,
        html: true,
        console: true,
      },
      validations: {
        dom: {
          exists: ['#username', '#password', '#login-button'],
          visible: ['#login-form'],
        },
        console: {
          maxErrors: 0,
          maxWarnings: 2,
        },
      },
    })

    // Fill in username
    .type('#username', 'testuser@example.com')

    // Fill in password
    .type('#password', 'password123', { clear: true })

    // Click login button
    .click('#login-button')

    // Wait for redirect or dashboard
    .wait(2000)

    // Create checkpoint - validate successful login
    .checkpoint('login-successful', {
      description: 'User successfully logged in',
      capture: {
        screenshot: true,
        html: true,
        console: true,
      },
      validations: {
        dom: {
          exists: ['#dashboard', '#user-profile'],
          notExists: ['#login-form', '#error-message'],
        },
        console: {
          forbiddenMessages: [
            { level: 'error', text: 'authentication failed', match: 'contains' },
          ],
        },
      },
    });

  // Execute the test
  const result = await test.run({ chrome, storage });

  console.log('Test Result:', result.status);
  console.log('Duration:', result.duration, 'ms');
  console.log('Checkpoints:', result.checkpoints.length);

  return result;
}

/**
 * Example: E-commerce product search test
 */
async function productSearchTest() {
  const mcpClient = {} as Client; // Placeholder
  const chrome = new ChromeDevToolsWrapper(mcpClient);
  const storage = new StorageManager({ baseDir: './test-storage' });

  const test = TestBuilder.create('Product Search Test')
    .description('Tests product search and filtering')
    .tags('e-commerce', 'search')

    .navigate('https://shop.example.com')

    .checkpoint('homepage-loaded', {
      capture: { screenshot: true, html: true },
      validations: {
        dom: {
          exists: ['#search-box', '#product-grid'],
        },
      },
    })

    .type('#search-box', 'laptop')
    .press('Enter')

    .wait(1000)

    .checkpoint('search-results', {
      description: 'Search results displayed',
      capture: { screenshot: true, html: true },
      validations: {
        dom: {
          exists: ['.product-card'],
          count: [
            { selector: '.product-card', count: 5, operator: 'greaterThanOrEqual' },
          ],
        },
      },
    })

    .click('.filter-price')
    .scroll({ y: 500, behavior: 'smooth' })

    .checkpoint('filtered-results', {
      capture: { screenshot: true },
    });

  return await test.run({ chrome, storage });
}

/**
 * Example: Form validation test
 */
async function formValidationTest() {
  const mcpClient = {} as Client; // Placeholder
  const chrome = new ChromeDevToolsWrapper(mcpClient);
  const storage = new StorageManager({ baseDir: './test-storage' });

  const test = TestBuilder.create('Form Validation Test')
    .description('Tests form validation errors')
    .tags('forms', 'validation')

    .navigate('https://example.com/contact')

    // Try to submit empty form
    .click('#submit-button')

    .checkpoint('validation-errors-shown', {
      description: 'Validation errors displayed for empty fields',
      capture: { screenshot: true, html: true },
      validations: {
        dom: {
          exists: ['.error-message'],
          count: [
            { selector: '.error-message', count: 3, operator: 'equal' },
          ],
        },
      },
    })

    // Fill in required fields
    .type('#name', 'John Doe')
    .type('#email', 'john@example.com')
    .type('#message', 'Test message', { delay: 50 })

    // Submit form
    .click('#submit-button')

    .wait(1000)

    .checkpoint('form-submitted', {
      description: 'Form submitted successfully',
      capture: { screenshot: true },
      validations: {
        dom: {
          exists: ['.success-message'],
          notExists: ['.error-message'],
        },
      },
    });

  return await test.run({ chrome, storage });
}

// Export examples
export {
  basicLoginTest,
  productSearchTest,
  formValidationTest,
};
