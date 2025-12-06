/**
 * Integration tests for install command.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadWorkspace, WorkspaceContext } from '../src/runtime/context.js';
import { SYSTEM_CONTEXTS } from '../src/prompts/adapters.js';
import { MANAGED_SENTINEL } from '../src/constants.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const TEST_OUTPUT_DIR = path.join(os.tmpdir(), 'enaible-test-install');

describe('System Contexts', () => {
  it('should have all expected systems configured', () => {
    const expectedSystems = ['claude-code', 'codex', 'copilot', 'cursor', 'gemini', 'antigravity'];
    for (const system of expectedSystems) {
      expect(SYSTEM_CONTEXTS).toHaveProperty(system);
    }
  });

  it('should have correct project scope directories', () => {
    expect(SYSTEM_CONTEXTS['claude-code'].projectScopeDir).toBe('.claude');
    expect(SYSTEM_CONTEXTS['codex'].projectScopeDir).toBe('.codex');
    expect(SYSTEM_CONTEXTS['copilot'].projectScopeDir).toBe('.github');
    expect(SYSTEM_CONTEXTS['cursor'].projectScopeDir).toBe('.cursor');
    expect(SYSTEM_CONTEXTS['gemini'].projectScopeDir).toBe('.gemini');
    expect(SYSTEM_CONTEXTS['antigravity'].projectScopeDir).toBe('.agent');
  });

  it('should have correct user scope directories', () => {
    expect(SYSTEM_CONTEXTS['claude-code'].userScopeDir).toBe('~/.claude');
    expect(SYSTEM_CONTEXTS['codex'].userScopeDir).toBe('~/.codex');
    expect(SYSTEM_CONTEXTS['copilot'].userScopeDir).toBe('~/.copilot');
    expect(SYSTEM_CONTEXTS['cursor'].userScopeDir).toBe('~/.cursor');
    expect(SYSTEM_CONTEXTS['gemini'].userScopeDir).toBe('~/.gemini');
    expect(SYSTEM_CONTEXTS['antigravity'].userScopeDir).toBe('~/.gemini/antigravity');
  });
});

describe('Workspace Context', () => {
  beforeAll(() => {
    process.env.ENAIBLE_REPO_ROOT = REPO_ROOT;
  });

  it('should load workspace context correctly', () => {
    const context = loadWorkspace();
    expect(context.repoRoot).toBe(REPO_ROOT);
    expect(context.sharedRoot).toContain('shared');
    expect(context.artifactsRoot).toBeTruthy();
  });

  it('should find shared folder', () => {
    const context = loadWorkspace();
    expect(fs.existsSync(context.sharedRoot)).toBe(true);
  });

  it('should create artifacts directory', () => {
    const context = loadWorkspace();
    expect(fs.existsSync(context.artifactsRoot)).toBe(true);
  });
});

describe('System Assets', () => {
  it('should have claude-code system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'claude-code');
    expect(fs.existsSync(systemPath)).toBe(true);
  });

  it('should have codex system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'codex');
    expect(fs.existsSync(systemPath)).toBe(true);
  });

  it('should have copilot system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'copilot');
    expect(fs.existsSync(systemPath)).toBe(true);
  });

  it('should have cursor system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'cursor');
    expect(fs.existsSync(systemPath)).toBe(true);
  });

  it('should have gemini system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'gemini');
    expect(fs.existsSync(systemPath)).toBe(true);
  });

  it('should have antigravity system assets', () => {
    const systemPath = path.join(REPO_ROOT, 'systems', 'antigravity');
    expect(fs.existsSync(systemPath)).toBe(true);
  });
});

describe('Template Files', () => {
  it('should have claude-code command template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'claude-code', 'templates', 'command.md.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('should have codex prompt template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'codex', 'templates', 'prompt.md.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('should have copilot prompt template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'copilot', 'templates', 'prompt.md.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('should have cursor command template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'cursor', 'templates', 'command.md.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('should have gemini command template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'gemini', 'templates', 'command.toml.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('should have antigravity workflow template', () => {
    const templatePath = path.join(REPO_ROOT, 'docs', 'system', 'antigravity', 'templates', 'workflow.md.j2');
    expect(fs.existsSync(templatePath)).toBe(true);
  });
});

describe('Shared Prompts', () => {
  const sharedPromptsDir = path.join(REPO_ROOT, 'shared', 'prompts');

  it('should have analyze-security prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'analyze-security.md'))).toBe(true);
  });

  it('should have analyze-architecture prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'analyze-architecture.md'))).toBe(true);
  });

  it('should have analyze-code-quality prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'analyze-code-quality.md'))).toBe(true);
  });

  it('should have analyze-performance prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'analyze-performance.md'))).toBe(true);
  });

  it('should have plan-refactor prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'plan-refactor.md'))).toBe(true);
  });

  it('should have plan-solution prompt', () => {
    expect(fs.existsSync(path.join(sharedPromptsDir, 'plan-solution.md'))).toBe(true);
  });
});

describe('Test Codebase Fixtures', () => {
  const testCodebasePath = path.join(REPO_ROOT, 'test_codebase');

  it('should have vulnerable-apps directory', () => {
    expect(fs.existsSync(path.join(testCodebasePath, 'vulnerable-apps'))).toBe(true);
  });

  it('should have clean-apps directory', () => {
    expect(fs.existsSync(path.join(testCodebasePath, 'clean-apps'))).toBe(true);
  });

  it('should have code-quality-issues directory', () => {
    expect(fs.existsSync(path.join(testCodebasePath, 'code-quality-issues'))).toBe(true);
  });

  it('should have juice-shop-monorepo directory', () => {
    expect(fs.existsSync(path.join(testCodebasePath, 'juice-shop-monorepo'))).toBe(true);
  });

  describe('Vulnerable Apps', () => {
    const vulnerableAppsPath = path.join(testCodebasePath, 'vulnerable-apps');

    it('should have test-python app', () => {
      expect(fs.existsSync(path.join(vulnerableAppsPath, 'test-python'))).toBe(true);
    });

    it('should have test-javascript app', () => {
      expect(fs.existsSync(path.join(vulnerableAppsPath, 'test-javascript'))).toBe(true);
    });

    it('should have test-java app', () => {
      expect(fs.existsSync(path.join(vulnerableAppsPath, 'test-java'))).toBe(true);
    });

    it('should have test-go app', () => {
      expect(fs.existsSync(path.join(vulnerableAppsPath, 'test-go'))).toBe(true);
    });
  });

  describe('Clean Apps', () => {
    const cleanAppsPath = path.join(testCodebasePath, 'clean-apps');

    it('should have clean-python app', () => {
      expect(fs.existsSync(path.join(cleanAppsPath, 'clean-python'))).toBe(true);
    });

    it('should have clean-javascript app', () => {
      expect(fs.existsSync(path.join(cleanAppsPath, 'clean-javascript'))).toBe(true);
    });

    it('should have clean-java app', () => {
      expect(fs.existsSync(path.join(cleanAppsPath, 'clean-java'))).toBe(true);
    });
  });
});

describe('Managed Sentinel', () => {
  it('should have correct managed sentinel value', () => {
    expect(MANAGED_SENTINEL).toBe('<!-- generated: enaible -->');
  });
});
