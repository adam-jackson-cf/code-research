/**
 * Prompt linting utilities.
 */

import fs from 'fs';
import { LintIssue } from './types.js';
import { extractVariables } from './utils.js';

const DOLLAR_TOKEN = /\$[A-Z][A-Z0-9_]*/g;
const AT_TOKEN = /@([A-Z][A-Z0-9_]*)/g;

/**
 * Strip code blocks from markdown text.
 */
function stripCodeBlocks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let fenced = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      fenced = !fenced;
      out.push('');
      continue;
    }
    if (fenced) {
      out.push('');
    } else {
      // Strip inline code spans as well
      out.push(line.replace(/`[^`]*`/g, ''));
    }
  }
  return out.join('\n');
}

/**
 * Lint content for variable issues.
 */
export function lintContent(filePath: string, content: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const [variables, body] = extractVariables(content);

  // 1) $-prefixed tokens are forbidden outside code blocks and mapping bullets
  const scrubbed = stripCodeBlocks(content);
  const scrubbedLines = scrubbed.split('\n');
  for (let idx = 0; idx < scrubbedLines.length; idx++) {
    const line = scrubbedLines[idx];
    const trimmed = line.trim();
    if (trimmed.startsWith('- @') || trimmed.startsWith('###') || trimmed.startsWith('## ')) {
      continue;
    }
    if (DOLLAR_TOKEN.test(line)) {
      issues.push({
        path: filePath,
        line: idx + 1,
        message: 'Found forbidden $VAR token; use @TOKEN mapping in Variables.',
      });
    }
    // Reset lastIndex for global regex
    DOLLAR_TOKEN.lastIndex = 0;
  }

  // 2) Every @TOKEN in body must be declared in Variables
  const declared = new Set(variables.map((v) => v.token));
  const bodyLines = body.split('\n');
  for (let idx = 0; idx < bodyLines.length; idx++) {
    const line = bodyLines[idx];
    let match;
    AT_TOKEN.lastIndex = 0;
    while ((match = AT_TOKEN.exec(line)) !== null) {
      const token = `@${match[1]}`;
      if (!declared.has(token)) {
        issues.push({
          path: filePath,
          line: idx + 1,
          message: `Undeclared token ${token} used in body.`,
        });
      }
    }
  }

  // 3) Shape checks for variables
  for (const v of variables) {
    if (!v.token.startsWith('@')) {
      issues.push({
        path: filePath,
        line: 1,
        message: `Variable token must start with @: ${v.token}`,
      });
    }
    if (v.kind === 'positional' && !v.positionalIndex) {
      issues.push({
        path: filePath,
        line: 1,
        message: `Required ${v.token} must map to $N index.`,
      });
    }
    if (v.kind === 'flag' && (!v.flagName || !v.flagName.startsWith('--'))) {
      issues.push({
        path: filePath,
        line: 1,
        message: `Optional ${v.token} must map to a --flag.`,
      });
    }
  }

  return issues;
}

/**
 * Lint multiple files.
 */
export function lintFiles(files: string[]): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      issues.push(...lintContent(filePath, content));
    } catch (err) {
      issues.push({
        path: filePath,
        line: 1,
        message: `Unable to read file: ${err}`,
      });
    }
  }
  return issues;
}
