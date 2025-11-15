import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBuilder, SmokeTest } from '../../src/api/test-builder.js';
import { StorageManager } from '../../src/storage/index.js';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

describe('Test Builder Integration Tests', () => {
  let tempDir: string;
  let storageManager: StorageManager;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'tmp', `test-builder-${Date.now()}`);
    await fs.ensureDir(tempDir);

    storageManager = new StorageManager({
      baseDir: tempDir,
    });
    await storageManager.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Fluent API Test Creation', () => {
    it('should create a test with basic configuration', () => {
      const test = TestBuilder.create('My Test')
        .description('Test description')
        .tags('smoke', 'regression')
        .timeout(30000)
        .viewport({ width: 1920, height: 1080 })
        .headless(true)
        .retries(3);

      const definition = test.toTestDefinition();

      expect(definition.name).toBe('My Test');
      expect(definition.description).toBe('Test description');
      expect(definition.tags).toContain('smoke');
      expect(definition.tags).toContain('regression');
      expect(definition.timeout).toBe(30000);
      expect(definition.viewport?.width).toBe(1920);
      expect(definition.viewport?.height).toBe(1080);
      expect(definition.headless).toBe(true);
      expect(definition.retries).toBe(3);
    });

    it('should chain multiple configuration methods', () => {
      const test = TestBuilder.create('Chained Test')
        .description('A test with chained methods')
        .tags('integration')
        .timeout(60000)
        .viewport({ width: 1280, height: 720, deviceScaleFactor: 2 })
        .env({ TEST_ENV: 'staging', API_KEY: 'test-key' });

      const definition = test.toTestDefinition();

      expect(definition.name).toBe('Chained Test');
      expect(definition.description).toBe('A test with chained methods');
      expect(definition.tags).toEqual(['integration']);
      expect(definition.timeout).toBe(60000);
      expect(definition.viewport?.deviceScaleFactor).toBe(2);
      expect(definition.env?.TEST_ENV).toBe('staging');
      expect(definition.env?.API_KEY).toBe('test-key');
    });
  });

  describe('Test Steps Creation', () => {
    it('should add navigation steps', () => {
      const test = TestBuilder.create('Navigation Test')
        .navigate('https://example.com')
        .navigate('https://example.com/login', {
          waitUntil: 'networkidle0',
          timeout: 5000,
        });

      const definition = test.toTestDefinition();

      expect(definition.steps).toHaveLength(2);
      expect(definition.steps[0].action).toBe('navigate');
      expect((definition.steps[0] as any).url).toBe('https://example.com');
      expect(definition.steps[1].action).toBe('navigate');
      expect((definition.steps[1] as any).url).toBe('https://example.com/login');
      expect((definition.steps[1] as any).options?.waitUntil).toBe('networkidle0');
    });

    it('should add interaction steps', () => {
      const test = TestBuilder.create('Interaction Test')
        .click('#submit-button')
        .type('#username', 'testuser', { delay: 100 })
        .select('#country', 'USA')
        .hover('.tooltip-trigger')
        .press('Enter', { delay: 50 })
        .scroll({ x: 0, y: 500, behavior: 'smooth' });

      const definition = test.toTestDefinition();

      expect(definition.steps).toHaveLength(6);

      const actions = definition.steps.map(s => s.action);
      expect(actions).toEqual(['click', 'type', 'select', 'hover', 'press', 'scroll']);

      // Verify click step
      const clickStep = definition.steps[0] as any;
      expect(clickStep.selector).toBe('#submit-button');

      // Verify type step
      const typeStep = definition.steps[1] as any;
      expect(typeStep.selector).toBe('#username');
      expect(typeStep.text).toBe('testuser');
      expect(typeStep.options?.delay).toBe(100);

      // Verify select step
      const selectStep = definition.steps[2] as any;
      expect(selectStep.selector).toBe('#country');
      expect(selectStep.value).toBe('USA');
    });

    it('should add wait steps with different conditions', () => {
      const test = TestBuilder.create('Wait Test')
        .wait(1000) // Wait for timeout
        .wait('#loading-spinner', { visible: false }) // Wait for element
        .wait({ type: 'networkidle', timeout: 5000 }); // Wait for network idle

      const definition = test.toTestDefinition();

      expect(definition.steps).toHaveLength(3);

      // Timeout wait
      const timeoutWait = definition.steps[0] as any;
      expect(timeoutWait.condition.type).toBe('timeout');
      expect(timeoutWait.condition.duration).toBe(1000);

      // Selector wait
      const selectorWait = definition.steps[1] as any;
      expect(selectorWait.condition.type).toBe('selector');
      expect(selectorWait.condition.selector).toBe('#loading-spinner');
      expect(selectorWait.condition.visible).toBe(false);

      // Network idle wait
      const networkWait = definition.steps[2] as any;
      expect(networkWait.condition.type).toBe('networkidle');
    });
  });

  describe('Checkpoint Creation', () => {
    it('should add checkpoint with basic configuration', () => {
      const test = TestBuilder.create('Checkpoint Test').checkpoint('homepage-loaded', {
        description: 'Homepage fully loaded',
        capture: {
          screenshot: true,
          html: true,
          console: true,
        },
      });

      const definition = test.toTestDefinition();

      expect(definition.steps).toHaveLength(1);
      expect(definition.steps[0].action).toBe('checkpoint');

      const checkpointStep = definition.steps[0] as any;
      expect(checkpointStep.checkpoint.name).toBe('homepage-loaded');
      expect(checkpointStep.checkpoint.description).toBe('Homepage fully loaded');
      expect(checkpointStep.checkpoint.capture.screenshot).toBe(true);
      expect(checkpointStep.checkpoint.capture.html).toBe(true);
      expect(checkpointStep.checkpoint.capture.console).toBe(true);
    });

    it('should add checkpoint with validations', () => {
      const test = TestBuilder.create('Validation Test').checkpoint('form-validation', {
        capture: {
          screenshot: true,
          html: true,
        },
        validations: {
          dom: {
            exists: ['#submit-button', '#form-input'],
            visible: ['#success-message'],
            textContent: [
              {
                selector: 'h1',
                text: 'Welcome',
                match: 'contains',
              },
            ],
          },
          console: {
            maxErrors: 0,
            maxWarnings: 2,
            forbiddenMessages: [
              {
                level: 'error',
                text: 'failed to load',
                match: 'contains',
              },
            ],
          },
        },
      });

      const definition = test.toTestDefinition();
      const checkpointStep = definition.steps[0] as any;

      expect(checkpointStep.checkpoint.validations.dom).toBeDefined();
      expect(checkpointStep.checkpoint.validations.dom.exists).toHaveLength(2);
      expect(checkpointStep.checkpoint.validations.console.maxErrors).toBe(0);
    });

    it('should add multiple checkpoints', () => {
      const test = TestBuilder.create('Multi-Checkpoint Test')
        .navigate('https://example.com')
        .checkpoint('page-loaded')
        .click('#login-button')
        .checkpoint('login-clicked')
        .type('#username', 'user')
        .checkpoint('username-entered');

      const definition = test.toTestDefinition();

      expect(definition.steps).toHaveLength(6);

      const checkpoints = definition.steps.filter(s => s.action === 'checkpoint');
      expect(checkpoints).toHaveLength(3);

      expect((checkpoints[0] as any).checkpoint.name).toBe('page-loaded');
      expect((checkpoints[1] as any).checkpoint.name).toBe('login-clicked');
      expect((checkpoints[2] as any).checkpoint.name).toBe('username-entered');
    });
  });

  describe('Complete Test Flows', () => {
    it('should create a login flow test', () => {
      const test = TestBuilder.create('Login Flow')
        .description('Test user login functionality')
        .tags('login', 'authentication', 'smoke')
        .viewport({ width: 1366, height: 768 })
        .navigate('https://example.com/login')
        .wait('#login-form', { visible: true })
        .checkpoint('login-page-loaded', {
          capture: { screenshot: true, html: true },
          validations: {
            dom: {
              exists: ['#username', '#password', '#submit'],
            },
          },
        })
        .type('#username', 'testuser@example.com')
        .type('#password', 'password123', { delay: 50 })
        .click('#submit')
        .wait({ type: 'navigation' })
        .checkpoint('login-successful', {
          capture: { screenshot: true, html: true, console: true },
          validations: {
            dom: {
              exists: ['#dashboard'],
              textContent: [
                {
                  selector: '.welcome-message',
                  text: 'Welcome',
                  match: 'contains',
                },
              ],
            },
            console: {
              maxErrors: 0,
            },
          },
        });

      const definition = test.toTestDefinition();

      expect(definition.name).toBe('Login Flow');
      expect(definition.tags).toContain('login');
      expect(definition.steps.length).toBeGreaterThan(5);

      // Verify flow structure
      const actions = definition.steps.map(s => s.action);
      expect(actions).toContain('navigate');
      expect(actions).toContain('wait');
      expect(actions).toContain('type');
      expect(actions).toContain('click');
      expect(actions).toContain('checkpoint');
    });

    it('should create a search flow test', () => {
      const test = TestBuilder.create('Search Flow')
        .description('Test search functionality')
        .tags('search', 'core-features')
        .navigate('https://example.com')
        .checkpoint('homepage')
        .click('#search-button')
        .wait('#search-input', { visible: true })
        .type('#search-input', 'integration testing')
        .press('Enter')
        .wait({ type: 'networkidle', timeout: 10000 })
        .checkpoint('search-results', {
          validations: {
            dom: {
              exists: ['.search-results'],
              count: [
                {
                  selector: '.result-item',
                  count: 1,
                  operator: 'greaterThanOrEqual',
                },
              ],
            },
          },
        });

      const definition = test.toTestDefinition();

      expect(definition.steps.length).toBeGreaterThan(6);

      const checkpoints = definition.steps.filter(s => s.action === 'checkpoint');
      expect(checkpoints).toHaveLength(2);
    });

    it('should create an e-commerce checkout flow', () => {
      const test = TestBuilder.create('Checkout Flow')
        .description('Complete checkout process')
        .tags('checkout', 'e2e')
        .timeout(60000)
        .navigate('https://example.com/products')
        .checkpoint('product-listing')
        .click('.product-card:first-child .add-to-cart')
        .wait('.cart-notification', { visible: true })
        .click('.cart-icon')
        .wait('#cart-page')
        .checkpoint('cart-page', {
          validations: {
            dom: {
              exists: ['.cart-item'],
              count: [
                {
                  selector: '.cart-item',
                  count: 1,
                  operator: 'greaterThanOrEqual',
                },
              ],
            },
          },
        })
        .click('#checkout-button')
        .wait('#checkout-form')
        .type('#email', 'test@example.com')
        .type('#address', '123 Test St')
        .select('#country', 'United States')
        .checkpoint('checkout-form-filled')
        .click('#submit-order')
        .wait('.success-message', { visible: true })
        .checkpoint('order-confirmed', {
          validations: {
            dom: {
              exists: ['.success-message', '.order-number'],
              textContent: [
                {
                  selector: '.success-message',
                  text: 'Order confirmed',
                  match: 'contains',
                },
              ],
            },
            console: {
              maxErrors: 0,
            },
          },
        });

      const definition = test.toTestDefinition();

      expect(definition.timeout).toBe(60000);
      expect(definition.steps.length).toBeGreaterThan(10);

      const checkpoints = definition.steps.filter(s => s.action === 'checkpoint');
      expect(checkpoints.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Before/After Hooks', () => {
    it('should add beforeAll hooks', () => {
      const test = TestBuilder.create('Test with Setup')
        .beforeAll(setup => {
          setup
            .navigate('https://example.com/setup')
            .click('#initialize-button')
            .wait(1000);
        })
        .navigate('https://example.com/test')
        .checkpoint('test-step');

      const definition = test.toTestDefinition();

      expect(definition.beforeAll).toBeDefined();
      expect(definition.beforeAll).toHaveLength(3);
      expect(definition.steps).toHaveLength(2);
    });

    it('should add afterAll hooks', () => {
      const test = TestBuilder.create('Test with Cleanup')
        .navigate('https://example.com/test')
        .checkpoint('test-step')
        .afterAll(cleanup => {
          cleanup
            .navigate('https://example.com/logout')
            .click('#logout-button')
            .wait({ type: 'navigation' });
        });

      const definition = test.toTestDefinition();

      expect(definition.afterAll).toBeDefined();
      expect(definition.afterAll).toHaveLength(3);
      expect(definition.steps).toHaveLength(2);
    });

    it('should support both beforeAll and afterAll', () => {
      const test = TestBuilder.create('Test with Both Hooks')
        .beforeAll(setup => {
          setup.navigate('https://example.com/login').wait(500);
        })
        .navigate('https://example.com/test')
        .checkpoint('main-test')
        .afterAll(cleanup => {
          cleanup.navigate('https://example.com/logout');
        });

      const definition = test.toTestDefinition();

      expect(definition.beforeAll).toHaveLength(2);
      expect(definition.steps).toHaveLength(2);
      expect(definition.afterAll).toHaveLength(1);
    });
  });

  describe('Test Definition Conversion', () => {
    it('should convert test to definition and back', () => {
      const original = TestBuilder.create('Original Test')
        .description('Original description')
        .tags('tag1', 'tag2')
        .timeout(45000)
        .viewport({ width: 1024, height: 768 })
        .headless(false)
        .retries(2)
        .navigate('https://example.com')
        .checkpoint('test-checkpoint');

      const definition = original.toTestDefinition();
      const reconstructed = TestBuilder.fromDefinition(definition);
      const reconstructedDef = reconstructed.toTestDefinition();

      expect(reconstructedDef.name).toBe(definition.name);
      expect(reconstructedDef.description).toBe(definition.description);
      expect(reconstructedDef.tags).toEqual(definition.tags);
      expect(reconstructedDef.timeout).toBe(definition.timeout);
      expect(reconstructedDef.viewport).toEqual(definition.viewport);
      expect(reconstructedDef.headless).toBe(definition.headless);
      expect(reconstructedDef.retries).toBe(definition.retries);
      expect(reconstructedDef.steps).toHaveLength(definition.steps.length);
    });

    it('should preserve step details in conversion', () => {
      const test = TestBuilder.create('Step Details Test')
        .navigate('https://example.com', { waitUntil: 'load', timeout: 10000 })
        .click('#button', { button: 'left', clickCount: 2 })
        .type('#input', 'text', { delay: 100, clear: true });

      const definition = test.toTestDefinition();
      const reconstructed = TestBuilder.fromDefinition(definition);
      const reconstructedDef = reconstructed.toTestDefinition();

      // Navigate step
      const navStep = reconstructedDef.steps[0] as any;
      expect(navStep.url).toBe('https://example.com');
      expect(navStep.options?.waitUntil).toBe('load');
      expect(navStep.options?.timeout).toBe(10000);

      // Click step
      const clickStep = reconstructedDef.steps[1] as any;
      expect(clickStep.selector).toBe('#button');
      expect(clickStep.options?.button).toBe('left');
      expect(clickStep.options?.clickCount).toBe(2);

      // Type step
      const typeStep = reconstructedDef.steps[2] as any;
      expect(typeStep.selector).toBe('#input');
      expect(typeStep.text).toBe('text');
      expect(typeStep.options?.delay).toBe(100);
      expect(typeStep.options?.clear).toBe(true);
    });
  });

  describe('Complex Test Scenarios', () => {
    it('should create a multi-page form test', () => {
      const test = TestBuilder.create('Multi-Page Form')
        .description('Test multi-step form submission')
        .tags('forms', 'multi-step')
        .viewport({ width: 1440, height: 900 })
        .timeout(90000)
        // Page 1: Personal Info
        .navigate('https://example.com/form/step1')
        .wait('#personal-info-form')
        .type('#first-name', 'John')
        .type('#last-name', 'Doe')
        .type('#email', 'john.doe@example.com')
        .checkpoint('personal-info-filled', {
          validations: {
            dom: {
              attributes: [
                {
                  selector: '#first-name',
                  attribute: 'value',
                  value: 'John',
                  match: 'exact',
                },
              ],
            },
          },
        })
        .click('#next-button')
        .wait({ type: 'navigation' })
        // Page 2: Address
        .wait('#address-form')
        .type('#street', '123 Main St')
        .type('#city', 'Springfield')
        .select('#state', 'IL')
        .type('#zip', '62701')
        .checkpoint('address-filled')
        .click('#next-button')
        .wait({ type: 'navigation' })
        // Page 3: Review & Submit
        .wait('#review-form')
        .checkpoint('review-page', {
          validations: {
            dom: {
              exists: ['.personal-info-summary', '.address-summary'],
              textContent: [
                {
                  selector: '.personal-info-summary',
                  text: 'John Doe',
                  match: 'contains',
                },
                {
                  selector: '.address-summary',
                  text: 'Springfield',
                  match: 'contains',
                },
              ],
            },
          },
        })
        .click('#submit-button')
        .wait('.confirmation-message', { visible: true })
        .checkpoint('form-submitted', {
          validations: {
            dom: {
              exists: ['.confirmation-message'],
              textContent: [
                {
                  selector: '.confirmation-message',
                  text: 'Thank you',
                  match: 'contains',
                },
              ],
            },
            console: {
              maxErrors: 0,
            },
          },
        });

      const definition = test.toTestDefinition();

      expect(definition.steps.length).toBeGreaterThan(20);

      const checkpoints = definition.steps.filter(s => s.action === 'checkpoint');
      expect(checkpoints).toHaveLength(4);

      const navigationSteps = definition.steps.filter(s => s.action === 'navigate');
      expect(navigationSteps.length).toBeGreaterThanOrEqual(1);
    });

    it('should create a data-driven test structure', () => {
      const testData = [
        { username: 'user1', password: 'pass1', expectedMessage: 'Welcome user1' },
        { username: 'user2', password: 'pass2', expectedMessage: 'Welcome user2' },
        { username: 'user3', password: 'pass3', expectedMessage: 'Welcome user3' },
      ];

      const tests = testData.map((data, index) => {
        return TestBuilder.create(`Login Test ${index + 1}`)
          .description(`Login test for ${data.username}`)
          .tags('login', 'data-driven')
          .navigate('https://example.com/login')
          .type('#username', data.username)
          .type('#password', data.password)
          .click('#submit')
          .wait('.welcome-message', { visible: true })
          .checkpoint(`login-${data.username}`, {
            validations: {
              dom: {
                textContent: [
                  {
                    selector: '.welcome-message',
                    text: data.expectedMessage,
                    match: 'contains',
                  },
                ],
              },
            },
          });
      });

      expect(tests).toHaveLength(3);

      tests.forEach((test, index) => {
        const definition = test.toTestDefinition();
        expect(definition.name).toBe(`Login Test ${index + 1}`);
        expect(definition.tags).toContain('data-driven');
      });
    });

    it('should create a responsive design test', () => {
      const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 },
      ];

      const tests = viewports.map(vp => {
        return TestBuilder.create(`Responsive Test - ${vp.name}`)
          .description(`Test layout on ${vp.name} viewport`)
          .tags('responsive', vp.name)
          .viewport({ width: vp.width, height: vp.height })
          .navigate('https://example.com')
          .wait('#main-content', { visible: true })
          .checkpoint(`${vp.name}-layout`, {
            capture: {
              screenshot: true,
              html: true,
            },
            validations: {
              dom: {
                exists: ['#header', '#main-content', '#footer'],
                visible: ['#navigation'],
              },
            },
          })
          .scroll({ y: 500 })
          .checkpoint(`${vp.name}-scrolled`, {
            capture: {
              screenshot: true,
            },
          });
      });

      expect(tests).toHaveLength(3);

      tests.forEach(test => {
        const definition = test.toTestDefinition();
        expect(definition.viewport).toBeDefined();
        expect(definition.steps.filter(s => s.action === 'checkpoint')).toHaveLength(2);
      });
    });
  });
});
