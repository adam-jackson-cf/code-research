/**
 * System adapter metadata for prompt rendering.
 */

import { SystemRenderContext } from './types.js';

export const SYSTEM_CONTEXTS: Record<string, SystemRenderContext> = {
  'claude-code': {
    name: 'claude-code',
    projectScopeDir: '.claude',
    userScopeDir: '~/.claude',
    description: 'Claude Code CLI',
  },
  codex: {
    name: 'codex',
    projectScopeDir: '.codex',
    userScopeDir: '~/.codex',
    description: 'Codex CLI',
  },
  copilot: {
    name: 'copilot',
    projectScopeDir: '.github',
    userScopeDir: '~/.copilot',
    description: 'GitHub Copilot',
  },
  cursor: {
    name: 'cursor',
    projectScopeDir: '.cursor',
    userScopeDir: '~/.cursor',
    description: 'Cursor IDE',
  },
  gemini: {
    name: 'gemini',
    projectScopeDir: '.gemini',
    userScopeDir: '~/.gemini',
    description: 'Gemini CLI',
  },
  antigravity: {
    name: 'antigravity',
    projectScopeDir: '.agent',
    userScopeDir: '~/.gemini/antigravity',
    description: 'Google Antigravity IDE',
  },
};
