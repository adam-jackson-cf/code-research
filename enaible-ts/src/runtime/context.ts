/**
 * Workspace discovery utilities for the Enaible CLI.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const SHARED_SENTINEL = path.join('shared', 'core', 'base', 'analyzer_registry.py');
const SENTINEL_RELATIVE = path.join('core', 'base', 'analyzer_registry.py');
const DEFAULT_SHARED_HOME = path.join(os.homedir(), '.enaible', 'workspace', 'shared');

/**
 * Resolved workspace paths required by the CLI.
 */
export interface WorkspaceContext {
  repoRoot: string;
  sharedRoot: string;
  artifactsRoot: string;
}

/**
 * Get path from environment variable if it exists.
 */
function envPath(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      const candidate = path.resolve(value.replace(/^~/, os.homedir()));
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Generate candidate roots from a starting path.
 */
function* candidateRoots(start: string): Generator<string> {
  yield start;
  let current = start;
  let parent = path.dirname(current);
  while (parent !== current) {
    yield parent;
    current = parent;
    parent = path.dirname(current);
  }
}

/**
 * Find the shared root directory.
 */
function findSharedRoot(): string | null {
  // Explicit env override
  const envShared = envPath('ENAIBLE_SHARED_ROOT');
  if (envShared && fs.existsSync(path.join(envShared, SENTINEL_RELATIVE))) {
    return envShared;
  }

  // Installed workspace copy (created by installer)
  if (fs.existsSync(path.join(DEFAULT_SHARED_HOME, SENTINEL_RELATIVE))) {
    return DEFAULT_SHARED_HOME;
  }

  return null;
}

/**
 * Find the repository root directory.
 */
function findRepoRoot(start: string | null = null, requireShared: boolean = true): string {
  const envRepo = envPath('ENAIBLE_REPO_ROOT');
  if (envRepo) {
    if (!requireShared || fs.existsSync(path.join(envRepo, SHARED_SENTINEL))) {
      return envRepo;
    }
  }

  const searchStart = path.resolve(start ?? process.cwd());
  if (!requireShared) {
    return searchStart;
  }

  for (const candidate of candidateRoots(searchStart)) {
    if (fs.existsSync(path.join(candidate, SHARED_SENTINEL))) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to locate repository root; set ENAIBLE_REPO_ROOT or run inside a checkout.'
  );
}

/**
 * Resolve the artifacts root directory.
 */
function resolveArtifactsRoot(repoRoot: string): string {
  let artifacts = envPath('ENAIBLE_ARTIFACTS_DIR', 'ENAIBLE_ARTIFACTS_ROOT');
  if (!artifacts) {
    artifacts = path.join(repoRoot, '.enaible');
  }
  if (!fs.existsSync(artifacts)) {
    fs.mkdirSync(artifacts, { recursive: true });
  }
  return artifacts;
}

/**
 * Resolve workspace paths.
 */
export function loadWorkspace(start: string | null = null): WorkspaceContext {
  let sharedRoot = findSharedRoot();

  // If we have a packaged/shared copy, we can relax repo discovery to the current tree.
  const repoRoot = findRepoRoot(start, sharedRoot === null);

  if (!sharedRoot) {
    sharedRoot = path.join(repoRoot, 'shared');
    if (!fs.existsSync(sharedRoot)) {
      throw new Error(
        `Shared analyzers folder missing at ${sharedRoot}; repository may be incomplete.`
      );
    }
  }

  const artifactsRoot = resolveArtifactsRoot(repoRoot);

  return {
    repoRoot,
    sharedRoot,
    artifactsRoot,
  };
}

/**
 * Public helper to locate the shared workspace root.
 */
export { findSharedRoot };
