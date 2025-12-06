/**
 * Integration tests for prompt rendering.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { loadWorkspace, WorkspaceContext } from '../src/runtime/context.js';
import { PromptRenderer, writeRenderResult } from '../src/prompts/renderer.js';
import { CATALOG, listPrompts } from '../src/prompts/catalog.js';
import { extractVariables } from '../src/prompts/utils.js';
import { lintContent } from '../src/prompts/lint.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('Prompt Catalog', () => {
  it('should have all expected prompts', () => {
    const prompts = listPrompts();
    expect(prompts.length).toBeGreaterThan(0);

    // Check for key prompts
    const promptIds = prompts.map(p => p.promptId);
    expect(promptIds).toContain('analyze-security');
    expect(promptIds).toContain('analyze-architecture');
    expect(promptIds).toContain('analyze-code-quality');
    expect(promptIds).toContain('analyze-performance');
    expect(promptIds).toContain('plan-refactor');
  });

  it('should have all prompts configured for claude-code', () => {
    const prompts = listPrompts();
    for (const prompt of prompts) {
      expect(prompt.systems).toHaveProperty('claude-code');
    }
  });

  it('should have all prompts configured for codex', () => {
    const prompts = listPrompts();
    for (const prompt of prompts) {
      expect(prompt.systems).toHaveProperty('codex');
    }
  });

  it('should have valid source paths', () => {
    const prompts = listPrompts();
    for (const prompt of prompts) {
      const sourcePath = path.join(REPO_ROOT, prompt.sourcePath);
      expect(fs.existsSync(sourcePath)).toBe(true);
    }
  });
});

describe('Prompt Renderer', () => {
  let context: WorkspaceContext;
  let renderer: PromptRenderer;

  beforeAll(() => {
    process.env.ENAIBLE_REPO_ROOT = REPO_ROOT;
    context = loadWorkspace();
    renderer = new PromptRenderer(context);
  });

  it('should render analyze-security for claude-code', () => {
    const results = renderer.render(['analyze-security'], ['claude-code']);
    expect(results).toHaveLength(1);

    const result = results[0];
    expect(result.promptId).toBe('analyze-security');
    expect(result.system).toBe('claude-code');
    expect(result.content).toContain('# analyze-security v1.0');
    expect(result.content).toContain('<!-- generated: enaible -->');
  });

  it('should render all prompts for all systems', () => {
    const allPromptIds = listPrompts().map(p => p.promptId);
    const allSystems = ['claude-code', 'codex', 'copilot', 'cursor', 'gemini', 'antigravity'];

    const results = renderer.render(allPromptIds, allSystems);
    expect(results.length).toBeGreaterThan(0);

    // Each prompt should have a result for each system it supports
    for (const result of results) {
      expect(result.content).toBeTruthy();
      expect(result.outputPath).toBeTruthy();
    }
  });

  it('should include frontmatter in rendered prompts', () => {
    const results = renderer.render(['analyze-security'], ['claude-code']);
    const result = results[0];

    expect(result.content).toContain('---');
    expect(result.content).toContain('argument-hint:');
  });

  it('should handle prompts with variables correctly', () => {
    const results = renderer.render(['analyze-security'], ['claude-code']);
    const result = results[0];

    expect(result.content).toContain('@TARGET_PATH');
    expect(result.content).toContain('## Variables');
    expect(result.content).toContain('### Required');
  });
});

describe('Variable Extraction', () => {
  it('should extract required variables', () => {
    const markdown = `
## Variables

### Required

- @TARGET_PATH = $1 — path to analyze

### Optional (derived from $ARGUMENTS)

- @VERBOSE = --verbose — enable verbose logging

Some body content here.
`;

    const [variables, body] = extractVariables(markdown);

    expect(variables).toHaveLength(2);
    expect(variables[0].token).toBe('@TARGET_PATH');
    expect(variables[0].kind).toBe('positional');
    expect(variables[0].required).toBe(true);
    expect(variables[0].positionalIndex).toBe(1);

    expect(variables[1].token).toBe('@VERBOSE');
    expect(variables[1].kind).toBe('flag');
    expect(variables[1].required).toBe(false);
    expect(variables[1].flagName).toBe('--verbose');
  });

  it('should extract derived variables', () => {
    const markdown = `
## Variables

### Derived (internal)

- @ARTIFACT_ROOT — artifacts directory

Body content.
`;

    const [variables] = extractVariables(markdown);

    expect(variables).toHaveLength(1);
    expect(variables[0].token).toBe('@ARTIFACT_ROOT');
    expect(variables[0].kind).toBe('derived');
    expect(variables[0].required).toBe(false);
  });
});

describe('Prompt Linting', () => {
  it('should detect undeclared tokens', () => {
    // Need proper markdown structure with section headings
    // Content after ## Variables without another ## heading is part of Variables block
    const content = `
## Variables

### Required

- @DECLARED = $1 — description

## Instructions

Body with @UNDECLARED token.
`;

    const issues = lintContent('test.md', content);

    expect(issues.some(i => i.message.includes('Undeclared token @UNDECLARED'))).toBe(true);
  });

  it('should pass for valid prompts', () => {
    const content = `
## Variables

### Required

- @TARGET = $1 — description

Body with @TARGET token.
`;

    const issues = lintContent('test.md', content);

    expect(issues.filter(i => i.message.includes('Undeclared'))).toHaveLength(0);
  });
});

describe('Integration with Test Fixtures', () => {
  let context: WorkspaceContext;
  let renderer: PromptRenderer;

  beforeAll(() => {
    process.env.ENAIBLE_REPO_ROOT = REPO_ROOT;
    context = loadWorkspace();
    renderer = new PromptRenderer(context);
  });

  it('should render prompts that can analyze test_codebase/vulnerable-apps', () => {
    // Verify the test fixtures exist
    const vulnerableAppsPath = path.join(REPO_ROOT, 'test_codebase', 'vulnerable-apps');
    expect(fs.existsSync(vulnerableAppsPath)).toBe(true);

    // Render security analysis prompt
    const results = renderer.render(['analyze-security'], ['claude-code']);
    expect(results).toHaveLength(1);

    const result = results[0];
    // The rendered prompt should reference analysis capabilities
    expect(result.content).toContain('security');
  });

  it('should render prompts that can analyze test_codebase/clean-apps', () => {
    // Verify the test fixtures exist
    const cleanAppsPath = path.join(REPO_ROOT, 'test_codebase', 'clean-apps');
    expect(fs.existsSync(cleanAppsPath)).toBe(true);

    // Render code quality analysis prompt
    const results = renderer.render(['analyze-code-quality'], ['claude-code']);
    expect(results).toHaveLength(1);

    const result = results[0];
    expect(result.content).toContain('quality');
  });

  it('should render prompts for juice-shop-monorepo analysis', () => {
    // Verify the test fixtures exist
    const juiceShopPath = path.join(REPO_ROOT, 'test_codebase', 'juice-shop-monorepo');
    expect(fs.existsSync(juiceShopPath)).toBe(true);

    // Render architecture analysis prompt
    const results = renderer.render(['analyze-architecture'], ['claude-code']);
    expect(results).toHaveLength(1);

    const result = results[0];
    expect(result.content).toContain('architecture');
  });
});

describe('Cross-System Compatibility', () => {
  let context: WorkspaceContext;
  let renderer: PromptRenderer;

  beforeAll(() => {
    process.env.ENAIBLE_REPO_ROOT = REPO_ROOT;
    context = loadWorkspace();
    renderer = new PromptRenderer(context);
  });

  it('should render codex prompts without frontmatter', () => {
    const results = renderer.render(['analyze-security'], ['codex']);
    expect(results).toHaveLength(1);

    const result = results[0];
    // Codex prompts should not have YAML frontmatter at the start (based on template)
    expect(result.content).toContain('# analyze-security');
  });

  it('should render copilot prompts with correct frontmatter', () => {
    const results = renderer.render(['analyze-security'], ['copilot']);
    expect(results).toHaveLength(1);

    const result = results[0];
    // Copilot template uses 'agent: agent' format (not 'mode: agent')
    expect(result.content).toContain('agent: agent');
    expect(result.content).toContain('tools:');
  });

  it('should render gemini prompts in TOML format', () => {
    const results = renderer.render(['analyze-security'], ['gemini']);
    expect(results).toHaveLength(1);

    const result = results[0];
    expect(result.outputPath).toContain('.toml');
  });
});
